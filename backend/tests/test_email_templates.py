import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import clear_memory_db
import tempfile
import pathlib


@pytest_asyncio.fixture
async def client():
    await clear_memory_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def signup(client, email="et@example.com"):
    r = await client.post("/api/auth/signup", json={"full_name": "O", "email": email, "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 200, r.text
    return r.json()


async def make_project(client, h, path, name="ET"):
    r = await client.post("/api/projects", json={"name": name, "description": "", "project_path": path, "tags": [], "status": "active"}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def make_laravel(tmp: str):
    base = pathlib.Path(tmp)
    (base / "artisan").write_text("#!/usr/bin/env php")
    (base / "composer.json").write_text('{"require": {"laravel/framework": "^10"}}')
    (base / "app").mkdir(exist_ok=True)
    (base / "resources" / "views" / "emails" / "hr").mkdir(parents=True, exist_ok=True)
    (base / "resources" / "views" / "emails" / "welcome.blade.php").write_text("<h1>Welcome {{ $employee->name }}</h1><p>{{ $company_name }}</p>")
    (base / "resources" / "views" / "emails" / "password-reset.blade.php").write_text("<a href=\"{{ $loginUrl }}\">Reset</a>")
    (base / "resources" / "views" / "emails" / "hr" / "onboarding.blade.php").write_text("@if($show_message)<p>{{ $message }}</p>@endif")
    (base / "resources" / "views" / "emails" / "notes.txt").write_text("ignore me")
    mod = base / "Modules" / "HR" / "resources" / "views" / "emails"
    mod.mkdir(parents=True, exist_ok=True)
    (mod / "employee-welcome.blade.php").write_text("<p>Hi {!! $employee->email !!}</p>")
    mod2 = base / "Modules" / "Leave" / "resources" / "views" / "emails"
    mod2.mkdir(parents=True, exist_ok=True)
    (mod2 / "leave-approved.blade.php").write_text("<p>Leave for {{ $employee->name }} approved</p>")


@pytest.mark.asyncio
async def test_general_crud_validation_authz_preview(client):
    data = await signup(client)
    h = {"Authorization": f"Bearer {data['access_token']}"}
    # create
    r = await client.post("/api/email-templates", json={"name": "Welcome", "description": "d", "content": "<h1>Hi {company_name} {email} {company_name}</h1>"}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["variables"] == ["company_name", "email"]
    tid = body["id"]
    # read
    r = await client.get(f"/api/email-templates/{tid}", headers=h)
    assert r.status_code == 200
    assert "<h1>" in r.json()["content"]
    # update persists HTML (no markdown conversion)
    r = await client.patch(f"/api/email-templates/{tid}", json={"content": "<p>Hello {employee_name}</p>"}, headers=h)
    assert r.json()["variables"] == ["employee_name"]
    # preview substitutes mock data
    r = await client.post("/api/email-templates/preview", json={"content": "<h1>{company_name}</h1>", "kind": "general"}, headers=h)
    assert r.status_code == 200
    assert "Acme Corporation" in r.json()["html"]
    # validation
    r = await client.post("/api/email-templates", json={"name": "", "content": "x"}, headers=h)
    assert r.status_code == 422
    # isolation: unknown id -> 404 (no leak)
    r = await client.get("/api/email-templates/nope", headers=h)
    assert r.status_code == 404
    r = await client.patch("/api/email-templates/nope", json={"name": "x"}, headers=h)
    assert r.status_code == 404
    # delete
    r = await client.delete(f"/api/email-templates/{tid}", headers=h)
    assert r.status_code == 200
    r = await client.get(f"/api/email-templates/{tid}", headers=h)
    assert r.status_code == 404
    # unauth
    r = await client.get("/api/email-templates")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_laravel_scanner_nested_modules_and_metadata(client):
    data = await signup(client, email="et3@example.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    tmp = tempfile.mkdtemp()
    make_laravel(tmp)
    pid = await make_project(client, h, tmp, name="BenchHR")
    r = await client.get(f"/api/projects/{pid}/email-templates", headers=h)
    assert r.status_code == 200, r.text
    items = {i["relative_path"]: i for i in r.json()}
    assert "resources/views/emails/welcome.blade.php" in items
    assert "resources/views/emails/password-reset.blade.php" in items
    assert "resources/views/emails/hr/onboarding.blade.php" in items
    assert "Modules/HR/resources/views/emails/employee-welcome.blade.php" in items
    assert "Modules/Leave/resources/views/emails/leave-approved.blade.php" in items
    assert "resources/views/emails/notes.txt" not in items
    assert items["Modules/HR/resources/views/emails/employee-welcome.blade.php"]["module"] == "HR"
    assert items["resources/views/emails/welcome.blade.php"]["module"] is None
    assert items["resources/views/emails/welcome.blade.php"]["framework"] == "laravel"
    # variables extracted
    w = items["resources/views/emails/welcome.blade.php"]
    names = [v["name"] for v in w["variables"]]
    assert "employee.name" in names and "company_name" in names
    # stable ids
    r2 = await client.post(f"/api/projects/{pid}/email-templates/scan", json={}, headers=h)
    assert r2.status_code == 200
    assert {i["id"] for i in r2.json()} == {i["id"] for i in r.json()}


@pytest.mark.asyncio
async def test_project_read_save_reextract_and_security(client):
    data = await signup(client, email="et4@example.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    tmp = tempfile.mkdtemp()
    make_laravel(tmp)
    pid = await make_project(client, h, tmp)
    r = await client.get(f"/api/projects/{pid}/email-templates", headers=h)
    tpl = next(i for i in r.json() if i["relative_path"] == "resources/views/emails/welcome.blade.php")
    tid = tpl["id"]
    # read actual file
    r = await client.get(f"/api/projects/{pid}/email-templates/{tid}", headers=h)
    assert r.status_code == 200, r.text
    assert "{{ $employee->name }}" in r.json()["content"]
    # save modifies real file + re-extracts
    new_content = "<h1>Hi {{ $new_var }}</h1>"
    r = await client.patch(f"/api/projects/{pid}/email-templates/{tid}", json={"content": new_content}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["content"] == new_content
    assert [v["name"] for v in r.json()["variables"]] == ["new_var"]
    assert pathlib.Path(tmp, "resources/views/emails/welcome.blade.php").read_text() == new_content
    # traversal blocked
    r = await client.get(f"/api/projects/{pid}/email-templates/{tid}", headers=h)
    # unknown id -> gone message
    r = await client.get(f"/api/projects/{pid}/email-templates/nope", headers=h)
    assert r.status_code == 404
    assert "no longer exists" in r.json()["detail"]
    # unsupported framework
    tmp2 = tempfile.mkdtemp()
    pid2 = await make_project(client, h, tmp2, name="Plain")
    r = await client.get(f"/api/projects/{pid2}/email-templates", headers=h)
    assert r.status_code == 400
    assert "not currently supported" in r.json()["detail"]
    # unknown project -> 404 (no leak)
    r = await client.get("/api/projects/nope/email-templates", headers=h)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_project_list_reports_framework(client):
    data = await signup(client, email="et6@example.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    tmp = tempfile.mkdtemp()
    make_laravel(tmp)
    await make_project(client, h, tmp, name="LarApp")
    tmp2 = tempfile.mkdtemp()
    await make_project(client, h, tmp2, name="PlainApp")
    r = await client.get("/api/projects", headers=h)
    assert r.status_code == 200, r.text
    by_name = {p["name"]: p for p in r.json()["items"]}
    assert by_name["LarApp"]["framework"] == "Laravel"
    assert by_name["PlainApp"]["framework"] not in ("Laravel", "laravel")


def test_blade_extractor_cases():
    from app.services.blade_parser import BladeEmailVariableExtractor, render_blade_preview
    src = "<h1>{{ $name }}</h1>{!! $html !!}@if($user)<p>{{ $employee->email }}</p>@endif @foreach($employees as $employee) x @endforeach"
    out = {v["name"]: v for v in BladeEmailVariableExtractor.extract(src)}
    assert "name" in out and out["name"]["raw"] == "{{ $name }}"
    assert "employee.email" in out
    assert "user" in out
    # dedup
    src2 = "{{ $a }} {{ $a }}"
    assert len(BladeEmailVariableExtractor.extract(src2)) == 1
    # no execution, plain text yields nothing
    assert BladeEmailVariableExtractor.extract("<p>hello</p>") == []
    # $-less echo is still a variable + preview substitutes dummy data
    assert BladeEmailVariableExtractor.extract("<p>{{ company_name }}</p>")[0]["name"] == "company_name"
    assert BladeEmailVariableExtractor.extract("<p>{{$company_name}}</p>")[0]["name"] == "company_name"
    assert "Acme Corporation" in render_blade_preview("<p>{{ company_name }}</p>")
    assert "Acme Corporation" in render_blade_preview("<p>{{$company_name}}</p>")
    assert "Acme Corporation" in render_blade_preview("<p>{{ $company_name }}</p>")
    assert "{{" not in render_blade_preview("<p>{{ $company_name }}</p>")


def test_general_preview_always_substitutes():
    from app.services.email_variables import render_general_preview
    assert render_general_preview("<h1>{company_name} {unknown_xyz}</h1>") == "<h1>Acme Corporation Sample Value</h1>"


def test_filesystem_security_unit():
    from app.services import email_scanner as sc
    import tempfile
    tmp = tempfile.mkdtemp()
    make_laravel(tmp)
    # traversal
    assert sc.read_project_template(tmp, "../.env")["ok"] is False
    assert sc.read_project_template(tmp, "/etc/passwd")["ok"] is False
    assert sc.read_project_template(tmp, ".env")["ok"] is False
    assert sc.read_project_template(tmp, "resources/views/emails/missing.blade.php")["ok"] is False
    # only blade allowed
    pathlib.Path(tmp, "resources/views/emails/x.txt").write_text("hi")
    assert sc.read_project_template(tmp, "resources/views/emails/x.txt")["ok"] is False
