DEFAULT_SYSTEM_PROMPT = """You are the Smart Engineering Agent for RAI Planner. Your job is to transform rough engineering tasks into high-quality, actionable tasks.

You MUST:
- Use actual project context and .brain information provided.
- Be specific, clear, and technically grounded.
- Include: objective, context, problem, technical understanding, expected behavior, implementation considerations, acceptance criteria, edge cases, testing, dependencies, affected files.
- Do NOT invent architecture not present in context. If uncertain, state uncertainty.
- Output must be Markdown.
"""

DEFAULT_PROJECT_SYSTEM_PROMPT = """You are an expert software engineer working on this project.

Before writing or modifying any task, understand the existing codebase.

Always inspect existing implementations before proposing new ones.

Prefer reusing existing functionality over creating duplicates.

When a task involves an API, verify whether the API already exists before creating a new endpoint.

Follow the project's existing architecture, conventions, validation, authorization, error handling, and testing patterns.

Every implementation task should include appropriate test cases.

Tests must be completed as part of the task implementation.

Do not modify unrelated functionality.

Preserve backward compatibility unless explicitly required otherwise.

Always provide a clear Definition of Done.

When uncertain, inspect the codebase rather than guessing.
"""

# Instructions for the model that *writes* a project system prompt (§19).
SYSTEM_PROMPT_GENERATOR_SYS = """You write engineering-policy system prompts for software projects.

Rules:
- Respond with ONLY the system prompt in Markdown. No preamble, no fences, no commentary.
- Adapt every rule to the detected project (framework, architecture, APIs, tests, conventions).
- Include only sections relevant to this project (Role, Project Context, Architecture Rules,
  Codebase Analysis Rules, API Rules, Database Rules, Testing Rules, Security Rules,
  Error Handling Rules, Performance Rules, Task Writing Rules, Documentation Rules,
  Git/Change Management Rules, Do Not Do Rules, Definition of Done).
- If an existing draft prompt is provided: preserve its valuable project-specific rules,
  remove outdated/generic ones, add missing project-specific rules, avoid duplication.
- NEVER include secrets, credentials, tokens, or .env values. Never invent file paths,
  endpoints, or architecture not evidenced in the analysis. Mark unknowns as "verify in code".
"""


class PromptManager:
    def __init__(self, custom_prompt: str = "", project_policy: str = "",
                 project_rules: list = None, template: str = ""):
        self.custom_prompt = custom_prompt or DEFAULT_SYSTEM_PROMPT
        self.project_policy = (project_policy or "").strip()
        self.project_rules = [r for r in (project_rules or []) if (r or "").strip()]
        self.template = (template or "").strip()

    def get_system_prompt(self) -> str:
        base = self.custom_prompt or DEFAULT_SYSTEM_PROMPT
        parts = []
        if self.project_policy:
            parts.append(
                "PROJECT ENGINEERING POLICY (highest priority — project-specific rules):\n"
                f"{self.project_policy}"
            )
        if self.project_rules:
            numbered = "\n".join(f"{i + 1}. {r.strip()}" for i, r in enumerate(self.project_rules))
            parts.append(
                "PROJECT RULES (mandatory constraints — satisfy every applicable rule. "
                "If a rule conflicts with the request or is technically impossible, "
                "flag the conflict explicitly instead of silently ignoring either side):\n"
                f"{numbered}"
            )
        parts.append(base)
        return "\n\n---\n\n".join(parts)

    def build_user_prompt(self, task: dict, project: dict, context: dict, skills_content: str = "",
                          testing_hint: str = "") -> str:
        brain = context.get("brain_content", "")[:8000]
        structure = "\n".join(context.get("structure_sample", [])[:80])
        top = ", ".join(context.get("top_level", [])[:30])
        task_type = (task.get("task_type") or "task").lower()
        template_section = (
            f"Selected Task Template (structural starting point — adapt sections to the task, "
            f"never copy blindly, and never let it override policy or rules):\n{self.template}\n"
            if self.template else ""
        )
        testing_section = (
            f"Project testing: {testing_hint}\n" if testing_hint else ""
        )
        test_requirement = ""
        if task_type == "feature":
            test_requirement = (
                "Test Cases section is MANDATORY for this Feature task: generate complete "
                "project-aware test cases (happy path, validation, authorization where applicable, "
                "edge cases, failure scenarios, regression scenarios). Only include relevant "
                "categories — no filler cases."
            )
        elif task_type == "bug":
            test_requirement = (
                "Test Cases section is MANDATORY for this Bug task: include a Regression Test that "
                "reproduces the original failure and verifies the fix, plus relevant edge cases, "
                "failure scenarios, validation/authorization checks, and existing-behavior checks. "
                "Never reduce this to a bare 'Add tests'."
            )
        return f"""Project: {project.get('name')} - {project.get('description','')}
Project Path: {project.get('project_path')}
Top-level: {top}
Structure sample:
{structure}

.brain content:
{brain if brain else '(no .brain or empty)'}

Enabled Skills:
{skills_content if skills_content else '(none)'}

{testing_section}Existing Task:
Title: {task.get('title')}
Type: {task_type}
Description:
{task.get('description')}

Priority: {task.get('priority')} Status: {task.get('status')} Tags: {task.get('tags')}

{template_section}Rewrite this task into a high-quality engineering task in Markdown. Follow the structure: Objective, Context, Problem, Technical Understanding, Architecture/Components, Expected Behavior, Implementation Considerations, Acceptance Criteria, Edge Cases, Testing, Dependencies, Affected Files. If project context is insufficient, note uncertainty. Above all, obey the PROJECT ENGINEERING POLICY and PROJECT RULES from the system message — they override everything else, including the template structure: add any section (e.g. Test Cases) the rules demand even if the template lacks it.
{test_requirement}
Before returning, run this quality gate and revise until satisfied: objective clear; existing implementation inspected; API reuse-vs-create decided with justification; policy, rules and template followed; Feature/Bug has project-aware Test Cases (Bug: reproducing regression test); test framework matches the project; Definition of Done present; no duplicate APIs; no unrelated changes; no raw {{{{variables}}}} left in the output.
"""
