import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import clear_memory_db
import tempfile, pathlib, os

@pytest_asyncio.fixture
async def client():
    await clear_memory_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def signup(client, email="owner@example.com", password="password123"):
    r = await client.post("/api/auth/signup", json={"full_name":"Test Owner","email":email,"password":password,"confirm_password":password})
    assert r.status_code==200, r.text
    return r.json()

async def login(client, email="owner@example.com", password="password123"):
    r = await client.post("/api/auth/login", json={"email":email,"password":password})
    assert r.status_code==200, r.text
    return r.json()

@pytest.mark.asyncio
async def test_auth_signup_login(client):
    data = await signup(client)
    token = data["access_token"]
    assert token
    # duplicate email
    r = await client.post("/api/auth/signup", json={"full_name":"X","email":"owner@example.com","password":"password123","confirm_password":"password123"})
    assert r.status_code==400
    # login success
    data2 = await login(client)
    assert data2["access_token"]
    # invalid login
    r = await client.post("/api/auth/login", json={"email":"owner@example.com","password":"wrongpass"})
    assert r.status_code==401
    # me
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==200
    assert r.json()["email"]=="owner@example.com"

@pytest.mark.asyncio
async def test_project_crud_disable(client):
    data = await signup(client, email="p1@example.com")
    token = data["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    # create project with temp path
    tmp = tempfile.mkdtemp()
    r = await client.post("/api/projects", json={"name":"Proj A","description":"desc","project_path":tmp,"tags":["tag1"],"status":"active"}, headers=h)
    assert r.status_code==200, r.text
    pid = r.json()["id"]
    # edit
    r = await client.put(f"/api/projects/{pid}", json={"name":"Proj A2"}, headers=h)
    assert r.status_code==200
    assert r.json()["name"]=="Proj A2"
    # disable
    r = await client.post(f"/api/projects/{pid}/disable", headers=h)
    assert r.status_code==200
    assert r.json()["status"]=="disabled"
    # ensure not deleted
    r = await client.get(f"/api/projects/{pid}", headers=h)
    assert r.status_code==200

@pytest.mark.asyncio
async def test_task_must_belong_to_project(client):
    data = await signup(client, email="t1@example.com")
    token = data["access_token"]; h={"Authorization": f"Bearer {token}"}
    # try create without valid project
    r = await client.post("/api/tasks", json={"project_id":"nonexistent","title":"Task","description":"desc"}, headers=h)
    assert r.status_code==400
    assert "project" in r.text.lower()
    # create project then task
    tmp = tempfile.mkdtemp()
    r = await client.post("/api/projects", json={"name":"P","description":"","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    pid = r.json()["id"]
    r = await client.post("/api/tasks", json={"project_id":pid,"title":"T1","description":"md","priority":"high","status":"todo","tags":["a"]}, headers=h)
    assert r.status_code==200
    tid = r.json()["id"]
    # editing
    r = await client.put(f"/api/tasks/{tid}", json={"title":"T1 updated"}, headers=h)
    assert r.status_code==200
    assert r.json()["title"]=="T1 updated"
    # activity history
    r = await client.get(f"/api/tasks/{tid}/activities", headers=h)
    assert r.status_code==200
    assert len(r.json()) >= 2
    # versions
    r = await client.get(f"/api/tasks/{tid}/versions", headers=h)
    assert r.status_code==200
    assert len(r.json()) >=2

@pytest.mark.asyncio
async def test_user_github(client):
    data = await signup(client, email="u1@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    # valid
    r = await client.post("/api/users", json={"full_name":"Dev One","email":"dev@example.com","github_url":"https://github.com/octocat"}, headers=h)
    assert r.status_code==200, r.text
    assert r.json()["github_username"]=="octocat"
    uid = r.json()["id"]
    # invalid url
    r = await client.post("/api/users", json={"full_name":"Bad","github_url":"https://example.com/bad"}, headers=h)
    assert r.status_code==400
    # edit github
    r = await client.put(f"/api/users/{uid}", json={"github_url":"https://github.com/newuser"}, headers=h)
    assert r.status_code==200
    assert r.json()["github_username"]=="newuser"

@pytest.mark.asyncio
async def test_ai_config_and_agent(client):
    data = await signup(client, email="ai@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    # get empty
    r = await client.get("/api/settings/ai-config", headers=h)
    assert r.status_code==200
    assert r.json()["has_key"]==False
    # set
    r = await client.put("/api/settings/ai-config", json={"provider_url":"https://api.openai.com/v1","model_name":"gpt-4o-mini","api_key":"sk-test-1234567890"}, headers=h)
    assert r.status_code==200
    assert r.json()["has_key"]==True
    assert "••••" in r.json()["api_key_masked"]
    # agent status
    r = await client.get("/api/settings/agent", headers=h)
    assert r.status_code==200
    assert "state" in r.json()
    # skill
    r = await client.post("/api/settings/skills", json={"name":"Skill1","description":"desc","instructions":"do something","enabled":True}, headers=h)
    assert r.status_code==200
    sid = r.json()["id"]
    r = await client.put(f"/api/settings/skills/{sid}", json={"enabled":False}, headers=h)
    assert r.status_code==200
    assert r.json()["enabled"]==False

@pytest.mark.asyncio
async def test_brain_detection_and_filesystem(client):
    data = await signup(client, email="brain@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    # no brain
    tmp = tempfile.mkdtemp()
    r = await client.post("/api/projects", json={"name":"NoBrain","description":"","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    pid = r.json()["id"]
    r = await client.get(f"/api/projects/{pid}/brain", headers=h)
    assert r.status_code==200
    assert r.json()["exists"]==False
    assert r.json()["message"]=="the ai tool need to instal on this project"
    # with brain
    os.makedirs(pathlib.Path(tmp)/".brain", exist_ok=True)
    pathlib.Path(tmp, ".brain", "doc.md").write_text("# Brain doc")
    r = await client.get(f"/api/projects/{pid}/brain", headers=h)
    assert r.json()["exists"]==True
    # filesystem safety - ensure context doesn't expose secrets
    # create .env should be ignored
    pathlib.Path(tmp, ".env").write_text("SECRET=123")
    from app.services.filesystem import collect_project_context
    ctx = collect_project_context(tmp)
    assert ".env" not in str(ctx)

@pytest.mark.asyncio
async def test_ai_generation_workflow(client):
    data = await signup(client, email="gen@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    # set AI config
    await client.put("/api/settings/ai-config", json={"provider_url":"mock://test","model_name":"mock-model","api_key":"sk-test-key"}, headers=h)
    tmp = tempfile.mkdtemp()
    os.makedirs(pathlib.Path(tmp)/".brain/architecture", exist_ok=True)
    pathlib.Path(tmp, ".brain/architecture", "svc.md").write_text("# Service architecture")
    r = await client.post("/api/projects", json={"name":"GenProj","description":"Test project","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    pid = r.json()["id"]
    r = await client.post("/api/tasks", json={"project_id":pid,"title":"Fix bug","description":"rough task","priority":"medium","status":"todo","tags":[]}, headers=h)
    tid = r.json()["id"]
    # generate
    r = await client.post(f"/api/tasks/{tid}/generate", headers=h)
    assert r.status_code==200, r.text
    assert "markdown" in r.json()
    # verify version and activity
    r = await client.get(f"/api/tasks/{tid}/versions", headers=h)
    assert len(r.json()) >=2
    r = await client.get(f"/api/tasks/{tid}/activities", headers=h)
    activities = r.json()
    assert any(a["action"]=="ai_generation" for a in activities)
    # check disabled button logic - task ai_generated true
    r = await client.get(f"/api/tasks/{tid}", headers=h)
    assert r.json()["ai_generated"]==True
    # second generate should fail
    r = await client.post(f"/api/tasks/{tid}/generate", headers=h)
    assert r.status_code==400

@pytest.mark.asyncio
async def test_dashboard(client):
    data = await signup(client, email="dash@example.com")
    h={"Authorization": f"Bearer {data['access_token']}"}
    tmp = tempfile.mkdtemp()
    await client.post("/api/projects", json={"name":"DashP","description":"","project_path":tmp,"tags":[],"status":"active"}, headers=h)
    r = await client.get("/api/dashboard?granularity=daily", headers=h)
    assert r.status_code==200
    assert "projects_total" in r.json()
    assert "tasks_by_status" in r.json()
