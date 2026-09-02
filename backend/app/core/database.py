import asyncio
import json
import logging
import pathlib
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

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

# Mongo wrapper

_mongo_client = None
_mongo_db = None
_use_memory = False

async def init_db():
    global _mongo_client, _mongo_db, _use_memory
    from .config import get_settings
    settings = get_settings()
    if not settings.MONGODB_URI:
        logger.info("MONGODB_URI not set, using in-memory database (persisted to .memory_db.json)")
        _use_memory = True
        _load_persist()
        return
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
        await _mongo_client.admin.command('ping')
        _mongo_db = _mongo_client[settings.MONGODB_DATABASE]
        # create indexes
        await _mongo_db["owners"].create_index("email", unique=True)
        await _mongo_db["projects"].create_index([("owner_id", 1), ("status", 1)])
        await _mongo_db["projects"].create_index([("created_at", -1)])
        await _mongo_db["tasks"].create_index([("owner_id", 1), ("project_id", 1)])
        await _mongo_db["tasks"].create_index([("status", 1)])
        await _mongo_db["tasks"].create_index([("priority", 1)])
        await _mongo_db["task_versions"].create_index([("task_id", 1), ("version", 1)])
        await _mongo_db["task_activities"].create_index([("task_id", 1)])
        await _mongo_db["users"].create_index([("owner_id", 1)])
        logger.info("Connected to MongoDB")
        _use_memory = False
    except Exception as e:
        logger.warning(f"MongoDB connection failed, falling back to memory: {e}")
        _use_memory = True

def get_collection(name: str):
    if _use_memory or _mongo_db is None:
        return InMemoryCollection(name)
    return _mongo_db[name]

def utc_now():
    return datetime.now(timezone.utc).isoformat()

# helper to generate id
def new_id() -> str:
    return str(uuid.uuid4())

async def clear_memory_db():
    async with _memory_lock:
        _memory_db.clear()
        _save_persist()
