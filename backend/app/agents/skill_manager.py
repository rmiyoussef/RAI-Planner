from app.core.database import get_collection, new_id, utc_now
from typing import List, Dict, Any

class SkillManager:
    def _col(self):
        return get_collection("agent_skills")

    async def list_for_owner(self, owner_id: str) -> List[Dict[str, Any]]:
        col = self._col()
        cur = await col.find({"owner_id": owner_id})
        # handle both memory and mongo cursors
        try:
            items = await cur.to_list(length=None)
        except Exception:
            items = []
            async for doc in cur:
                items.append(doc)
        return items

    async def enabled_skills_text(self, owner_id: str) -> str:
        skills = await self.list_for_owner(owner_id)
        enabled = [s for s in skills if s.get("enabled")]
        if not enabled:
            return ""
        parts = []
        for s in enabled:
            parts.append(f"Skill: {s['name']}\nDescription: {s.get('description','')}\nInstructions: {s.get('instructions','')}")
        return "\n\n".join(parts)

    async def create(self, owner_id: str, data: dict) -> dict:
        doc = {
            "_id": new_id(),
            "owner_id": owner_id,
            "name": data["name"],
            "description": data.get("description",""),
            "instructions": data["instructions"],
            "enabled": data.get("enabled", True),
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        await self._col().insert_one(doc)
        return doc

    async def update(self, skill_id: str, owner_id: str, data: dict) -> dict:
        col = self._col()
        existing = await col.find_one({"_id": skill_id, "owner_id": owner_id})
        if not existing:
            return None
        upd = {}
        for k in ["name","description","instructions","enabled"]:
            if k in data and data[k] is not None:
                upd[k] = data[k]
        upd["updated_at"] = utc_now()
        await col.update_one({"_id": skill_id}, {"$set": upd})
        return await col.find_one({"_id": skill_id})

    async def delete(self, skill_id: str, owner_id: str) -> bool:
        col = self._col()
        r = await col.delete_one({"_id": skill_id, "owner_id": owner_id})
        return r.deleted_count > 0
