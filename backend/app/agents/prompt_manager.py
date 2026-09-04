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
    def __init__(self, custom_prompt: str = "", project_policy: str = ""):
        self.custom_prompt = custom_prompt or DEFAULT_SYSTEM_PROMPT
        self.project_policy = (project_policy or "").strip()

    def get_system_prompt(self) -> str:
        base = self.custom_prompt or DEFAULT_SYSTEM_PROMPT
        if self.project_policy:
            return (
                "PROJECT ENGINEERING POLICY (highest priority — project-specific rules):\n"
                f"{self.project_policy}\n\n---\n\n{base}"
            )
        return base

    def build_user_prompt(self, task: dict, project: dict, context: dict, skills_content: str = "") -> str:
        brain = context.get("brain_content", "")[:8000]
        structure = "\n".join(context.get("structure_sample", [])[:80])
        top = ", ".join(context.get("top_level", [])[:30])
        return f"""Project: {project.get('name')} - {project.get('description','')}
Project Path: {project.get('project_path')}
Top-level: {top}
Structure sample:
{structure}

.brain content:
{brain if brain else '(no .brain or empty)'}

Enabled Skills:
{skills_content if skills_content else '(none)'}

Existing Task:
Title: {task.get('title')}
Description:
{task.get('description')}

Priority: {task.get('priority')} Status: {task.get('status')} Tags: {task.get('tags')}

Rewrite this task into a high-quality engineering task in Markdown. Follow the structure: Objective, Context, Problem, Technical Understanding, Architecture/Components, Expected Behavior, Implementation Considerations, Acceptance Criteria, Edge Cases, Testing, Dependencies, Affected Files. If project context is insufficient, note uncertainty. Above all, obey the PROJECT ENGINEERING POLICY from the system message — its rules override everything else.
"""
