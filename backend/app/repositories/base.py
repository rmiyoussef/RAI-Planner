from app.core.database import get_collection, new_id, utc_now
from typing import Dict, Any, Optional, List
import re

class BaseRepository:
    def __init__(self, collection_name: str):
        self.collection_name = collection_name

    def col(self):
        return get_collection(self.collection_name)
