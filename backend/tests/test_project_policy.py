import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import clear_memory_db
import tempfile

@pytest_asyncio.fixture
async def client():
    await clear_memory_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def signup(client, email="pp@example.com"):
    r = await client.post("/api/auth/signup", json={"full_name": "O", "email": email, "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 200, r.text
    return r.json()

async def make_project(client, h, name="PP"):
    tmp = tempfile.mkdtemp()
    r = await client.post("/api/projects", json={"name": name, "description": "", "project_path": tmp, "tags": [], "status": "active"}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]

@pytest.mark.asyncio
async def test_rules_crud_and_scoping(client):
    data = await signup(client)
    h = {"Authorization": f"Bearer {data['access_token']}"}
    pid = await make_project(client, h)
    # defaults seeded on create: 1 rule (test rule), 3 templates
    r = await client.get(f"/api/projects/{pid}/rules", headers=h)
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
    assert "test" in r.json()[0]["content"].lower()
    # create
    r = await client.post(f"/api/projects/{pid}/rules", json={"content": "Never duplicate APIs.", "enabled": True}, headers=h)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert r.json()["position"] == 1
    # update (disable)
    r = await client.patch(f"/api/projects/{pid}/rules/{rid}", json={"enabled": False}, headers=h)
    assert r.json()["enabled"] is False
    # cross-project isolation (rules are bound to their project)
    pid2 = await make_project(client, h, name="PP-other")
    r = await client.get(f"/api/projects/{pid2}/rules", headers=h)
    assert all(rule["project_id"] == pid2 for rule in r.json())
    r = await client.patch(f"/api/projects/{pid2}/rules/{rid}", json={"enabled": True}, headers=h)
    assert r.status_code == 404
    r = await client.delete(f"/api/projects/{pid2}/rules/{rid}", headers=h)
    assert r.status_code == 404
    # unknown project -> 404 (no existence leak)
    r = await client.get("/api/projects/nope/rules", headers=h)
    assert r.status_code == 404
    # delete
    r = await client.delete(f"/api/projects/{pid}/rules/{rid}", headers=h)
    assert r.status_code == 200
    r = await client.get(f"/api/projects/{pid}/rules", headers=h)
    assert len(r.json()) == 1  # back to the default

@pytest.mark.asyncio
async def test_templates_defaults_and_edit(client):
    data = await signup(client)
    h = {"Authorization": f"Bearer {data['access_token']}"}
    pid = await make_project(client, h)
    r = await client.get(f"/api/projects/{pid}/task-templates", headers=h)
    assert r.status_code == 200, r.text
    tpls = {t["type"]: t for t in r.json()}
    assert set(tpls) == {"task", "feature", "bug"}
    assert "{{title}}" in tpls["feature"]["content"]
    # edit feature template
    fid = tpls["feature"]["id"]
    r = await client.patch(f"/api/projects/{pid}/task-templates/{fid}", json={"content": "# {{title}}\n\nCustom body."}, headers=h)
    assert r.status_code == 200
    assert r.json()["content"] == "# {{title}}\n\nCustom body."
    # invalid type rejected
    r = await client.patch(f"/api/projects/{pid}/task-templates/{fid}", json={"type": "epic"}, headers=h)
    assert r.status_code == 422

@pytest.mark.asyncio
async def test_generation_includes_rules_and_template(client, monkeypatch):
    from app.agents.smart_engineering_agent import agent as singleton_agent
    data = await signup(client, email="pp3@example.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    await client.put("/api/settings/ai-config", json={"provider_url": "mock://test", "model_name": "mock-model", "api_key": "sk-test-key"}, headers=h)
    pid = await make_project(client, h, name="HR System")
    # custom rule
    await client.post(f"/api/projects/{pid}/rules", json={"content": "RULE-UNIQUE-999: every API change needs auth."}, headers=h)
    # disable the default test rule so only ours (plus template) flows
    r = await client.get(f"/api/projects/{pid}/rules", headers=h)
    for rule in r.json():
        if "RULE-UNIQUE-999" not in rule["content"]:
            await client.patch(f"/api/projects/{pid}/rules/{rule['id']}", json={"enabled": False}, headers=h)
    # pick feature template
    r = await client.get(f"/api/projects/{pid}/task-templates", headers=h)
    fid = [t for t in r.json() if t["type"] == "feature"][0]["id"]
    # feature task with template
    r = await client.post("/api/tasks", json={"project_id": pid, "title": "AddDeptFilter", "description": "rough", "priority": "medium", "status": "todo", "tags": [], "task_type": "feature", "template_id": fid}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["template_id"] == fid
    tid = r.json()["id"]

    captured = {}
    real_mock = singleton_agent.ai_provider._mock_generation
    def fake(sys_prompt, user_prompt, model):
        captured["system"] = sys_prompt
        captured["user"] = user_prompt
        return real_mock(sys_prompt, user_prompt, model)
    monkeypatch.setattr(singleton_agent.ai_provider, "_mock_generation", fake)
    r = await client.post(f"/api/tasks/{tid}/generate", headers=h)
    assert r.status_code == 200, r.text
    # rules in system message, mandatory framing
    assert "RULE-UNIQUE-999" in captured["system"]
    assert "mandatory" in captured["system"].lower()
    # template rendered with vars, no raw placeholders
    assert "AddDeptFilter" in captured["user"]
    assert "{{title}}" not in captured["user"]
    assert "Selected Task Template" in captured["user"]
    # feature => mandatory test cases + quality gate
    assert "Test Cases section is MANDATORY" in captured["user"]
    assert "Quality gate" in captured["user"] or "quality gate" in captured["user"]
    # bad template rejected at create
    r = await client.post("/api/tasks", json={"project_id": pid, "title": "X", "description": "", "priority": "medium", "status": "todo", "tags": [], "task_type": "task", "template_id": "nope"}, headers=h)
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_generation_without_template_still_works(client, monkeypatch):
    from app.agents.smart_engineering_agent import agent as singleton_agent
    data = await signup(client, email="pp4@example.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    await client.put("/api/settings/ai-config", json={"provider_url": "mock://test", "model_name": "mock-model", "api_key": "sk-test-key"}, headers=h)
    pid = await make_project(client, h)
    r = await client.post("/api/tasks", json={"project_id": pid, "title": "T", "description": "rough", "priority": "medium", "status": "todo", "tags": [], "task_type": "bug"}, headers=h)
    tid = r.json()["id"]
    assert r.json().get("template_id") is None
    captured = {}
    real_mock = singleton_agent.ai_provider._mock_generation
    def fake(sys_prompt, user_prompt, model):
        captured["user"] = user_prompt
        return real_mock(sys_prompt, user_prompt, model)
    monkeypatch.setattr(singleton_agent.ai_provider, "_mock_generation", fake)
    r = await client.post(f"/api/tasks/{tid}/generate", headers=h)
    assert r.status_code == 200, r.text
    # default test rule flowed in (seeded), bug => regression requirement
    assert "Test Cases section is MANDATORY" in captured["user"]
    assert "Regression Test" in captured["user"] or "regression" in captured["user"].lower()
    assert "Selected Task Template" not in captured["user"]

def test_render_template_vars():
    from app.agents.project_policy import render_template
    out = render_template("# {{title}}\n{{unknown}} {{project_name}}!", {"title": "T", "project_name": "P"})
    assert out == "# T\n P!"
    assert "{{" not in out
