DEFAULT_SYSTEM_PROMPT = """You are the Smart Engineering Agent for RAI Planner. Your job is to transform rough engineering tasks into high-quality, actionable tasks.

You MUST:
- Use actual project context and .brain information provided.
- Be specific, clear, and technically grounded.
- Include: objective, context, problem, technical understanding, expected behavior, implementation considerations, acceptance criteria, edge cases, testing, dependencies, affected files.
- Do NOT invent architecture not present in context. If uncertain, state uncertainty.
- Output must be Markdown.
"""

class PromptManager:
    def __init__(self, custom_prompt: str = ""):
        self.custom_prompt = custom_prompt or DEFAULT_SYSTEM_PROMPT

    def get_system_prompt(self) -> str:
        return self.custom_prompt or DEFAULT_SYSTEM_PROMPT

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

Rewrite this task into a high-quality engineering task in Markdown. Follow the structure: Objective, Context, Problem, Technical Understanding, Architecture/Components, Expected Behavior, Implementation Considerations, Acceptance Criteria, Edge Cases, Testing, Dependencies, Affected Files. If project context is insufficient, note uncertainty.
"""
