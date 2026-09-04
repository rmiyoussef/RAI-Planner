import asyncio
import logging
import re
from datetime import datetime, timezone
from app.core.database import get_collection, new_id, utc_now
from app.agents.brain_reader import BrainReader
from app.agents.prompt_manager import PromptManager
from app.agents.skill_manager import SkillManager
from app.agents.ai_provider import AIProvider
from app.services.filesystem import validate_project_path, collect_project_context

logger = logging.getLogger(__name__)

# Live per-task generation progress (in-memory; tiny, overwritten each run).
# Shape: {"status": "idle"|"running"|"done"|"error", "stage": int 0..6, "detail": str}
# Stages map to the frontend GENERATING_STAGES list; stage == 6 means all done.
_generation_progress: dict[str, dict] = {}

def get_generation_progress(owner_id: str, subject: str, scope: str = "task") -> dict:
    return _generation_progress.get(
        f"{owner_id}:{subject}:{scope}", {"status": "idle", "stage": 0, "detail": ""}
    )

class SmartEngineeringAgent:
    def __init__(self):
        self.state = "idle"
        self.is_running = False
        self.last_activity = None
        self.last_success = None
        self.last_error = None
        self.brain_reader = BrainReader()
        self.skill_manager = SkillManager()
        self.ai_provider = AIProvider()

    async def get_status(self, owner_id: str):
        # fetch system prompt and config
        settings_col = get_collection("agent_settings")
        cfg = await settings_col.find_one({"owner_id": owner_id})
        ai_col = get_collection("ai_configs")
        ai_cfg = await ai_col.find_one({"owner_id": owner_id})
        return {
            "state": self.state,
            "is_running": self.is_running,
            "last_activity": self.last_activity,
            "last_success": self.last_success,
            "last_error": self.last_error,
            "provider_url": ai_cfg.get("provider_url") if ai_cfg else None,
            "model_name": ai_cfg.get("model_name") if ai_cfg else None,
            "system_prompt": cfg.get("system_prompt") if cfg else None,
        }

    async def ensure_settings(self, owner_id: str):
        col = get_collection("agent_settings")
        existing = await col.find_one({"owner_id": owner_id})
        if not existing:
            from app.agents.prompt_manager import DEFAULT_SYSTEM_PROMPT
            doc = {
                "_id": new_id(),
                "owner_id": owner_id,
                "system_prompt": DEFAULT_SYSTEM_PROMPT,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
            await col.insert_one(doc)
            return doc
        return existing

    async def update_system_prompt(self, owner_id: str, prompt: str):
        await self.ensure_settings(owner_id)
        col = get_collection("agent_settings")
        await col.update_one({"owner_id": owner_id}, {"$set": {"system_prompt": prompt, "updated_at": utc_now()}})
        self.last_activity = utc_now()
        return await col.find_one({"owner_id": owner_id})

    async def start(self):
        self.is_running = True
        self.state = "running"
        self.last_activity = utc_now()
        logger.info("Agent started")

    async def stop(self):
        self.is_running = False
        self.state = "stopped"
        self.last_activity = utc_now()
        logger.info("Agent stopped")

    async def restart(self):
        await self.stop()
        await asyncio.sleep(0.1)
        await self.start()
        return await self.get_status(owner_id="system")  # placeholder

    def _set_progress(self, owner_id: str, subject: str, stage: int, status: str = "running", detail: str = "", scope: str = "task"):
        _generation_progress[f"{owner_id}:{subject}:{scope}"] = {
            "status": status,
            "stage": stage,
            "detail": detail,
            "updated_at": utc_now(),
        }

    async def generate_task(self, owner_id: str, task_id: str) -> dict:
        """Main workflow 16 steps. Returns generated markdown."""
        self.state = "running"
        self.last_activity = utc_now()
        self._set_progress(owner_id, task_id, 0, "running", "Loading task")
        started_at = datetime.now(timezone.utc)
        run_id = new_id()
        runs_col = get_collection("agent_runs")
        # create run doc
        await runs_col.insert_one({
            "_id": run_id,
            "owner_id": owner_id,
            "task_id": task_id,
            "project_id": "",
            "status": "running",
            "started_at": started_at.isoformat(),
            "completed_at": None,
            "duration_ms": None,
            "provider": None,
            "model": None,
            "error_category": None,
            "error_message": None,
        })
        try:
            # 1-3 load task/project
            tasks_col = get_collection("tasks")
            task = await tasks_col.find_one({"_id": task_id, "owner_id": owner_id})
            if not task:
                raise ValueError("Task not found")
            if task.get("ai_generated"):
                raise ValueError("Task already AI-generated; generation disabled")
            projects_col = get_collection("projects")
            project = await projects_col.find_one({"_id": task["project_id"], "owner_id": owner_id})
            if not project:
                raise ValueError("Project not found for task")
            project_path = project.get("project_path")
            # 4 validate path
            valid, msg = validate_project_path(project_path)
            if not valid:
                raise ValueError(f"Project path error: {msg}")
            # Project engineering policy FIRST — before context, prompts, or model calls.
            from app.agents.prompt_manager import DEFAULT_PROJECT_SYSTEM_PROMPT
            stored_policy = (project.get("system_prompt") or "").strip()
            project_policy = stored_policy or DEFAULT_PROJECT_SYSTEM_PROMPT
            logger.info(
                "Task %s: using project system prompt (%s, %d chars)",
                task_id, "custom" if stored_policy else "default", len(project_policy),
            )
            self._set_progress(owner_id, task_id, 0, "running", "Reading project system prompt")
            # 5-6 inspect .brain/context
            self._set_progress(owner_id, task_id, 1, "running", "Scanning project files & .brain")
            context = collect_project_context(project_path)
            # 7 load AI config
            ai_col = get_collection("ai_configs")
            ai_cfg = await ai_col.find_one({"owner_id": owner_id})
            if not ai_cfg or not ai_cfg.get("api_key_encrypted"):
                raise ValueError("AI configuration missing: API key required")
            provider = ai_cfg.get("provider_url")
            model = ai_cfg.get("model_name")
            # 8 system prompt
            settings_col = get_collection("agent_settings")
            settings = await settings_col.find_one({"owner_id": owner_id})
            await self.ensure_settings(owner_id)
            if not settings:
                from app.agents.prompt_manager import DEFAULT_SYSTEM_PROMPT
                system_prompt = DEFAULT_SYSTEM_PROMPT
            else:
                system_prompt = settings.get("system_prompt")
            # 9 skills
            skills_text = await self.skill_manager.enabled_skills_text(owner_id)
            # 10 build prompts (project engineering policy takes priority)
            self._set_progress(owner_id, task_id, 2, "running", "Building context & prompt")
            pm = PromptManager(system_prompt, project_policy=project_policy)
            user_prompt = pm.build_user_prompt(task, project, context, skills_text)
            system_prompt = pm.get_system_prompt()
            # 11-13 generate
            # ensure agent is considered running
            if not self.is_running:
                await self.start()
            self._set_progress(owner_id, task_id, 3, "running", "Analyzing task")
            def _provider_cb(msg: str):
                self._set_progress(owner_id, task_id, 4, "running", msg)
            markdown = await self.ai_provider.generate(
                owner_id, system_prompt, user_prompt, on_progress=_provider_cb
            )
            self._set_progress(owner_id, task_id, 5, "running", "Saving new version")
            # 14 save as new version
            # update task description
            new_version = task.get("version", 1) + 1
            # save version history (current before update)
            versions_col = get_collection("task_versions")
            await versions_col.insert_one({
                "_id": new_id(),
                "task_id": task_id,
                "owner_id": owner_id,
                "version": task.get("version", 1),
                "title": task.get("title"),
                "description": task.get("description"),
                "priority": task.get("priority"),
                "status": task.get("status"),
                "assigned_to": task.get("assigned_to"),
                "tags": task.get("tags", []),
                "created_at": utc_now(),
            })
            # also insert new version snapshot
            await versions_col.insert_one({
                "_id": new_id(),
                "task_id": task_id,
                "owner_id": owner_id,
                "version": new_version,
                "title": task.get("title"),
                "description": markdown,
                "priority": task.get("priority"),
                "status": task.get("status"),
                "assigned_to": task.get("assigned_to"),
                "tags": task.get("tags", []),
                "created_at": utc_now(),
            })
            # update task
            await tasks_col.update_one({"_id": task_id}, {"$set": {
                "description": markdown,
                "ai_generated": True,
                "version": new_version,
                "updated_at": utc_now()
            }})
            # 15 activity
            activities_col = get_collection("task_activities")
            await activities_col.insert_one({
                "_id": new_id(),
                "task_id": task_id,
                "owner_id": owner_id,
                "timestamp": utc_now(),
                "action": "ai_generation",
                "actor": owner_id,
                "changes": [{"field": "description", "old_value": task.get("description")[:200], "new_value": "AI-generated content"}],
                "version": new_version,
            })
            # success run update
            completed = datetime.now(timezone.utc)
            duration = int((completed - started_at).total_seconds() * 1000)
            await runs_col.update_one({"_id": run_id}, {"$set": {
                "status": "completed",
                "completed_at": completed.isoformat(),
                "duration_ms": duration,
                "provider": provider,
                "model": model,
                "project_id": project["_id"],
            }})
            self.state = "idle"
            self.last_success = completed.isoformat()
            self.last_activity = utc_now()
            self._set_progress(owner_id, task_id, 6, "done", "Saved")
            # fetch updated task
            updated = await tasks_col.find_one({"_id": task_id})
            return {"markdown": markdown, "task": updated, "run_id": run_id}
        except Exception as e:
            err_msg = str(e)
            # categorize
            cat = "internal"
            if "API key" in err_msg or "configuration" in err_msg.lower():
                cat = "configuration_error"
            elif "Provider" in err_msg:
                cat = "provider_error"
            elif "Project path" in err_msg:
                cat = "project_path_error"
            elif "already AI-generated" in err_msg:
                cat = "already_generated"
            elif "timeout" in err_msg.lower():
                cat = "timeout"
            completed = datetime.now(timezone.utc)
            duration = int((completed - started_at).total_seconds() * 1000)
            try:
                await runs_col.update_one({"_id": run_id}, {"$set": {
                    "status": "failed",
                    "completed_at": completed.isoformat(),
                    "duration_ms": duration,
                    "error_category": cat,
                    "error_message": err_msg[:500]
                }})
            except: pass
            self.state = "failed"
            self.last_error = err_msg[:500]
            self.last_activity = utc_now()
            try:
                cur_stage = get_generation_progress(owner_id, task_id).get("stage", 0)
                self._set_progress(owner_id, task_id, cur_stage, "error", err_msg[:200])
            except: pass
            raise

    async def generate_system_prompt(self, owner_id: str, project_id: str) -> dict:
        """Analyze the actual project and draft its engineering system prompt.

        Read-only: never modifies source, never persists. The caller decides
        whether to apply the result. Returns {"system_prompt", "analysis"}.
        Progress is reported under scope "sysprompt" for live UI polling.
        """
        from app.agents.prompt_manager import SYSTEM_PROMPT_GENERATOR_SYS
        from app.services.filesystem import (
            analyze_project, collect_project_context, validate_project_path,
        )

        def prog(stage: int, detail: str, status: str = "running"):
            self._set_progress(owner_id, project_id, stage, status, detail, scope="sysprompt")

        self.state = "running"
        self.last_activity = utc_now()
        prog(0, "Reading project structure")
        try:
            projects_col = get_collection("projects")
            project = await projects_col.find_one({"_id": project_id, "owner_id": owner_id})
            if not project:
                raise ValueError("Project not found")
            project_path = project.get("project_path") or ""
            valid, msg = validate_project_path(project_path)
            if not valid:
                raise ValueError(f"Project path error: {msg}")
            if not self.is_running:
                await self.start()

            prog(1, "Detecting framework & architecture")
            analysis = analyze_project(project_path)
            prog(2, "Inspecting APIs")
            prog(3, "Inspecting tests")
            prog(4, "Reading .brain & docs")
            context = collect_project_context(project_path)
            brain = (context.get("brain_content") or "")[:8000]
            structure = "\n".join((context.get("structure_sample") or [])[:80])
            top = ", ".join((context.get("top_level") or [])[:30])

            prog(5, "Building engineering rules")
            import json as _json
            existing = ((project.get("system_prompt") or "").strip())[:4000]
            user_prompt = f"""Project: {project.get('name')} - {project.get('description', '')}
Project Path: {project.get('project_path')}
Top-level: {top}
Structure sample:
{structure}

Detected analysis (verify against code; mark unknowns as "verify in code"):
{_json.dumps(analysis, indent=1)[:4000]}

.brain content:
{brain if brain else '(no .brain or empty)'}

Existing system prompt draft (preserve its valuable project-specific rules, improve the rest):
{existing if existing else '(none — write a fresh project-specific prompt)'}

Generate the best project-specific engineering system prompt now."""

            prog(6, "Generating prompt")
            def _provider_cb(msg: str):
                self._set_progress(owner_id, project_id, 6, "running", msg, scope="sysprompt")
            raw = await self.ai_provider.generate(
                owner_id, SYSTEM_PROMPT_GENERATOR_SYS, user_prompt, on_progress=_provider_cb
            )
            # Strip accidental fences — callers expect raw prompt Markdown.
            cleaned = (raw or "").strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```[\w+-]*\n?", "", cleaned)
                cleaned = re.sub(r"\n?```\s*$", "", cleaned).strip()
            if not cleaned:
                raise RuntimeError("AI provider returned an empty system prompt.")
            self.state = "idle"
            self.last_success = utc_now()
            self.last_activity = utc_now()
            prog(7, "Done", status="done")
            return {"system_prompt": cleaned, "analysis": analysis}
        except Exception as e:
            err_msg = str(e)
            self.state = "failed"
            self.last_error = err_msg[:500]
            self.last_activity = utc_now()
            try:
                cur = get_generation_progress(owner_id, project_id, scope="sysprompt").get("stage", 0)
                self._set_progress(owner_id, project_id, cur, "error", err_msg[:200], scope="sysprompt")
            except: pass
            raise

# global singleton
agent = SmartEngineeringAgent()
