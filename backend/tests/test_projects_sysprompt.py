import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import clear_memory_db
import tempfile, pathlib

@pytest_asyncio.fixture
async def client():
    await clear_memory_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def signup(client, email="sysp@example.com"):
    r = await client.post("/api/auth/signup", json={"full_name":"Owner","email":email,"password":"password123","confirm_password":"password123"})
    assert r.status_code==200, r.text
    return r.json()

def make_node_project():
    tmp = tempfile.mkdtemp()
    pathlib.Path(tmp, "package.json").write_text('{"dependencies":{"react":"18.0.0","express":"4.0.0"},"devDependencies":{"vitest":"1.0.0"}}')
    os.makedirs(pathlib.Path(tmp)/"src"/"routers", exist_ok=True)
    os.makedirs(pathlib.Path(tmp)/"tests", exist_ok=True)
    pathlib.Path(tmp, "README.md").write_text("# Demo")
    return tmp

import os

@pytest.mark.asyncio
async def test_project_system_prompt_defaults_and_save(client):
    data = await signup(client)
    h={"Authorization": f"Bearer {data['access_token']}"}
    tmp = tempfile.mkdtemp()
    # create without prompt -> default applied
    r = await client.post("/api/projects", json={"name":"P1","description":"","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    assert r.status_code==200, r.text
    body = r.json()
    assert body["system_prompt"], "default system prompt must be present"
    assert "existing codebase" in body["system_prompt"].lower() or "engineer" in body["system_prompt"].lower()
    pid = body["id"]
    # save custom prompt via dedicated endpoint (no reload semantics needed)
    custom = "Custom policy: always check routes first."
    r = await client.put(f"/api/projects/{pid}/system-prompt", json={"system_prompt": custom}, headers=h)
    assert r.status_code==200, r.text
    assert r.json()["system_prompt"] == custom
    # GET reflects persisted value
    r = await client.get(f"/api/projects/{pid}", headers=h)
    assert r.json()["system_prompt"] == custom
    # general update path also accepts it
    r = await client.put(f"/api/projects/{pid}", json={"system_prompt": "v2 policy"}, headers=h)
    assert r.json()["system_prompt"] == "v2 policy"

@pytest.mark.asyncio
async def test_generate_system_prompt_no_persist(client):
    data = await signup(client, email="sysp2@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    await client.put("/api/settings/ai-config", json={"provider_url":"mock://test","model_name":"mock-model","api_key":"sk-test-key"}, headers=h)
    tmp = make_node_project()
    r = await client.post("/api/projects", json={"name":"NodeApp","description":"demo","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    pid = r.json()["id"]
    before = r.json()["system_prompt"]
    # generate (mock provider) — must be project-specific and NOT persisted
    r = await client.post(f"/api/projects/{pid}/system-prompt/generate", headers=h)
    assert r.status_code==200, r.text
    gen = r.json()["system_prompt"]
    assert gen and gen != before
    assert "analysis" in r.json()
    assert r.json()["analysis"]["framework"] in ("React", "Node.js", "Next.js")
    r = await client.get(f"/api/projects/{pid}", headers=h)
    assert r.json()["system_prompt"] == before, "generate must not auto-persist"
    # progress endpoint reports done
    r = await client.get(f"/api/projects/{pid}/system-prompt/generate/progress", headers=h)
    assert r.status_code==200
    assert r.json()["status"] == "done"

@pytest.mark.asyncio
async def test_generate_system_prompt_bad_path(client):
    data = await signup(client, email="sysp3@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    await client.put("/api/settings/ai-config", json={"provider_url":"mock://test","model_name":"mock-model","api_key":"sk-test-key"}, headers=h)
    tmp = tempfile.mkdtemp()
    r = await client.post("/api/projects", json={"name":"Bad","description":"","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    pid = r.json()["id"]
    # point project at a nonexistent path via direct update bypass? use PUT with bad path -> 400 at save time is fine,
    # instead test missing project 404
    r = await client.post("/api/projects/nonexistent/system-prompt/generate", headers=h)
    assert r.status_code==404

@pytest.mark.asyncio
async def test_task_generation_uses_project_policy(client):
    from app.agents.prompt_manager import PromptManager
    pm = PromptManager("agent-base", project_policy="POLICY: reuse APIs.")
    combined = pm.get_system_prompt()
    assert "POLICY: reuse APIs." in combined and "agent-base" in combined
    pm2 = PromptManager("agent-base")
    assert pm2.get_system_prompt() == "agent-base"
