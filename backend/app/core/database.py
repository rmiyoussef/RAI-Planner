import asyncio
import json
import logging
import pathlib
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Allowed collections — prevents SQL injection via table name and limits surface
ALLOWED_COLLECTIONS = {
    "owners",
    "company_settings",
    "projects",
    "tasks",
    "task_versions",
    "task_activities",
    "users",
    "ai_configs",
    "agent_skills",
    "agent_settings",
    "skills",
    "project_rules",
    "task_templates",
}

def _validate_collection_name(name: str):
    if name not in ALLOWED_COLLECTIONS:
        # For backwards compat, allow any alphanumeric + underscore, but block injection
        if not name.replace("_", "").isalnum() or len(name) > 64:
            raise ValueError(f"Invalid collection name: {name}")
        logger.warning(f"Using non-whitelisted collection: {name}")

# Global in-memory fallback with file persistence so restarts don't log everyone out
_PERSIST_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / ".memory_db.json"
_memory_db: Dict[str, Dict[str, Dict[str, Any]]] = {}
_memory_lock = asyncio.Lock()


def _load_persist():
    try:
        if _PERSIST_PATH.exists():
            data = json.loads(_PERSIST_PATH.read_text())
            if isinstance(data, dict):
                _memory_db.clear()
                _memory_db.update(data)
                logger.info(f"Loaded persisted memory DB ({len(data)} collections) from {_PERSIST_PATH.name}")
    except Exception as e:
        logger.warning(f"Failed to load persisted DB: {e}")


def _save_persist():
    try:
        _PERSIST_PATH.parent.mkdir(parents=True, exist_ok=True)
        # atomic write
        tmp = _PERSIST_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(_memory_db, indent=2, default=str))
        tmp.replace(_PERSIST_PATH)
    except Exception as e:
        logger.warning(f"Failed to persist DB: {e}")

class InMemoryCollection:
    def __init__(self, name: str):
        _validate_collection_name(name)
        self.name = name
        if name not in _memory_db:
            _memory_db[name] = {}

    async def insert_one(self, doc: Dict[str, Any]):
        async with _memory_lock:
            _id = doc.get("_id") or str(uuid.uuid4())
            doc["_id"] = _id
            _memory_db[self.name][_id] = doc.copy()
            _save_persist()
            class R: inserted_id = _id
            return R()

    async def find_one(self, filt: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with _memory_lock:
            for doc in _memory_db[self.name].values():
                if _matches(doc, filt):
                    return doc.copy()
            return None

    async def find(self, filt: Dict[str, Any] = None, sort=None, skip=0, limit=0):
        # return cursor-like async iterable
        filt = filt or {}
        async with _memory_lock:
            docs = [d.copy() for d in _memory_db[self.name].values() if _matches(d, filt)]
        # sort
        if sort:
            for key, direction in reversed(sort):
                docs.sort(key=lambda x: x.get(key) or "", reverse=(direction == -1))
        if skip:
            docs = docs[skip:]
        if limit:
            docs = docs[:limit]
        return InMemoryCursor(docs)

    async def update_one(self, filt: Dict[str, Any], update: Dict[str, Any]):
        async with _memory_lock:
            for _id, doc in list(_memory_db[self.name].items()):
                if _matches(doc, filt):
                    if "$set" in update:
                        doc.update(update["$set"])
                    if "$inc" in update:
                        for k, v in update["$inc"].items():
                            doc[k] = doc.get(k, 0) + v
                    _memory_db[self.name][_id] = doc
                    _save_persist()
                    class R: modified_count = 1
                    return R()
            class R: modified_count = 0
            return R()

    async def delete_one(self, filt: Dict[str, Any]):
        async with _memory_lock:
            for _id, doc in list(_memory_db[self.name].items()):
                if _matches(doc, filt):
                    del _memory_db[self.name][_id]
                    _save_persist()
                    class R: deleted_count = 1
                    return R()
            class R: deleted_count = 0
            return R()

    async def count_documents(self, filt: Dict[str, Any]) -> int:
        async with _memory_lock:
            return sum(1 for d in _memory_db[self.name].values() if _matches(d, filt))

    async def create_index(self, *args, **kwargs):
        return

class InMemoryCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs
    def sort(self, *args):
        return self
    def skip(self, n):
        self.docs = self.docs[n:]
        return self
    def limit(self, n):
        if n:
            self.docs = self.docs[:n]
        return self
    async def to_list(self, length=None):
        if length is None:
            return self.docs
        return self.docs[:length]
    def __aiter__(self):
        async def gen():
            for d in self.docs:
                yield d
        return gen()

def _matches(doc: Dict[str, Any], filt: Dict[str, Any]) -> bool:
    for k, v in filt.items():
        # support simple operators
        if isinstance(v, dict):
            # $in, $ne, $regex
            if "$in" in v:
                if doc.get(k) not in v["$in"]:
                    return False
            elif "$ne" in v:
                if doc.get(k) == v["$ne"]:
                    return False
            elif "$regex" in v:
                import re
                pattern = v["$regex"]
                opts = v.get("$options", "")
                flags = re.IGNORECASE if "i" in opts else 0
                if not re.search(pattern, str(doc.get(k, "")), flags):
                    return False
            elif "$gte" in v or "$lte" in v:
                val = doc.get(k)
                if val is None:
                    return False
                if "$gte" in v and val < v["$gte"]:
                    return False
                if "$lte" in v and val > v["$lte"]:
                    return False
            else:
                if doc.get(k) != v:
                    return False
        else:
            if doc.get(k) != v:
                return False
    return True

# PostgreSQL implementation

_pg_pool = None
_pg_lock = asyncio.Lock()
_use_postgres = False

async def _ensure_pg_table(pool, name: str):
    _validate_collection_name(name)
    # simple table with id TEXT PK and data JSONB
    # use quoted identifier to be safe
    safe = '"' + name.replace('"', '""') + '"'
    async with pool.acquire() as conn:
        await conn.execute(f'CREATE TABLE IF NOT EXISTS {safe} (id TEXT PRIMARY KEY, data JSONB)')

class PostgresCollection:
    def __init__(self, name: str, pool):
        _validate_collection_name(name)
        self.name = name
        self.pool = pool
        self._safe = '"' + name.replace('"', '""') + '"'

    async def _ensure(self):
        await _ensure_pg_table(self.pool, self.name)

    async def insert_one(self, doc: Dict[str, Any]):
        await self._ensure()
        _id = doc.get("_id") or str(uuid.uuid4())
        doc["_id"] = _id
        # store copy
        data_json = json.dumps(doc, default=str)
        async with self.pool.acquire() as conn:
            await conn.execute(f'INSERT INTO {self._safe} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = $2::jsonb', _id, data_json)
        class R: inserted_id = _id
        return R()

    async def find_one(self, filt: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        await self._ensure()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(f'SELECT data FROM {self._safe}')
            for r in rows:
                doc = r['data']
                # asyncpg may return dict or string
                if isinstance(doc, str):
                    doc = json.loads(doc)
                if _matches(doc, filt):
                    return doc
            return None

    async def find(self, filt: Dict[str, Any] = None, sort=None, skip=0, limit=0):
        await self._ensure()
        filt = filt or {}
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(f'SELECT data FROM {self._safe}')
            docs = []
            for r in rows:
                doc = r['data']
                if isinstance(doc, str):
                    doc = json.loads(doc)
                if _matches(doc, filt):
                    docs.append(doc)
        if sort:
            for key, direction in reversed(sort):
                docs.sort(key=lambda x: x.get(key) or "", reverse=(direction == -1))
        if skip:
            docs = docs[skip:]
        if limit:
            docs = docs[:limit]
        return InMemoryCursor(docs)

    async def update_one(self, filt: Dict[str, Any], update: Dict[str, Any]):
        await self._ensure()
        # find matching doc
        doc = await self.find_one(filt)
        if not doc:
            class R: modified_count = 0
            return R()
        _id = doc["_id"]
        if "$set" in update:
            doc.update(update["$set"])
        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = doc.get(k, 0) + v
        data_json = json.dumps(doc, default=str)
        async with self.pool.acquire() as conn:
            await conn.execute(f'UPDATE {self._safe} SET data = $1::jsonb WHERE id = $2', data_json, _id)
        class R: modified_count = 1
        return R()

    async def delete_one(self, filt: Dict[str, Any]):
        await self._ensure()
        doc = await self.find_one(filt)
        if not doc:
            class R: deleted_count = 0
            return R()
        _id = doc["_id"]
        async with self.pool.acquire() as conn:
            await conn.execute(f'DELETE FROM {self._safe} WHERE id = $1', _id)
        class R: deleted_count = 1
        return R()

    async def count_documents(self, filt: Dict[str, Any]) -> int:
        await self._ensure()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(f'SELECT data FROM {self._safe}')
            cnt = 0
            for r in rows:
                doc = r['data']
                if isinstance(doc, str):
                    doc = json.loads(doc)
                if _matches(doc, filt):
                    cnt += 1
            return cnt

    async def create_index(self, *args, **kwargs):
        # no-op for now, but could create GIN index on data
        return

async def init_db():
    global _pg_pool, _use_postgres
    from .config import get_settings
    settings = get_settings()
    # Prefer PostgreSQL if URI set
    pg_uri = getattr(settings, 'POSTGRES_URI', '') or ""
    # fallback to MONGODB_URI for backwards compat (but we want postgres)
    if pg_uri:
        try:
            import asyncpg
            # try to connect with 2s timeout
            _pg_pool = await asyncpg.create_pool(dsn=pg_uri, min_size=1, max_size=5, command_timeout=5)
            # test connection
            async with _pg_pool.acquire() as conn:
                await conn.execute('SELECT 1')
            # ensure core tables exist
            for t in ["owners", "company_settings", "projects", "tasks", "task_versions", "task_activities", "users", "ai_configs", "agent_skills"]:
                await _ensure_pg_table(_pg_pool, t)
            # migrate from file if postgres empty but file has data
            try:
                if _PERSIST_PATH.exists():
                    data = json.loads(_PERSIST_PATH.read_text())
                    if isinstance(data, dict) and data:
                        # check if postgres is empty
                        empty = True
                        for col in data.keys():
                            cnt = 0
                            try:
                                async with _pg_pool.acquire() as conn:
                                    rows = await conn.fetch(f'SELECT count(*) FROM "{col.replace(chr(34), chr(34)+chr(34))}"')
                                    if rows:
                                        cnt = rows[0][0]
                            except:
                                cnt = 0
                            if cnt > 0:
                                empty = False
                                break
                        if empty:
                            logger.info("Migrating in-memory file data to PostgreSQL...")
                            for col_name, docs in data.items():
                                if not isinstance(docs, dict):
                                    continue
                                for doc in docs.values():
                                    try:
                                        safe = '"' + col_name.replace('"', '""') + '"'
                                        _id = doc.get("_id") or str(uuid.uuid4())
                                        doc["_id"] = _id
                                        j = json.dumps(doc, default=str)
                                        async with _pg_pool.acquire() as conn:
                                            await conn.execute(f'INSERT INTO {safe} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', _id, j)
                                    except Exception as e:
                                        logger.warning(f"Migration failed for {col_name}/{_id}: {e}")
                            logger.info("Migration to PostgreSQL done")
            except Exception as e:
                logger.warning(f"Migration check failed: {e}")
            logger.info(f"Connected to PostgreSQL at {pg_uri.split('@')[-1]}")
            _use_postgres = True
            return
        except Exception as e:
            logger.warning(f"PostgreSQL connection failed ({pg_uri.split('@')[-1] if '@' in pg_uri else pg_uri}): {e} — falling back to in-memory")
            _pg_pool = None
            _use_postgres = False
    # fallback to in-memory
    logger.info("Using in-memory database (persisted to .memory_db.json)")
    _load_persist()

def get_collection(name: str):
    _validate_collection_name(name)
    if _use_postgres and _pg_pool is not None:
        return PostgresCollection(name, _pg_pool)
    # fallback to in-memory (handles both file and mock)
    return InMemoryCollection(name)

def utc_now():
    return datetime.now(timezone.utc).isoformat()

# helper to generate id
def new_id() -> str:
    return str(uuid.uuid4())

async def clear_memory_db():
    # for tests: clear both postgres and file if using postgres, else file
    if _use_postgres and _pg_pool is not None:
        # clear postgres tables for test isolation
        try:
            async with _pg_pool.acquire() as conn:
                # get all tables we know
                for t in ["owners", "company_settings", "projects", "tasks", "task_versions", "task_activities", "users", "ai_configs", "agent_skills"]:
                    try:
                        safe = '"' + t.replace('"', '""') + '"'
                        await conn.execute(f'DELETE FROM {safe}')
                    except:
                        pass
        except Exception as e:
            logger.warning(f"Failed to clear postgres: {e}")
    async with _memory_lock:
        _memory_db.clear()
        _save_persist()
