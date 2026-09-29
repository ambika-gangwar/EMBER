"""
Smart AI Notes - Dual-Mode Resilient Database Layer
Connects to MongoDB (Motor) if available.
Automatically falls back to local SQLite with identical async collection API
if MongoDB is unreachable or unconfigured.
"""
import os
import json
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union

import bcrypt
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    HAS_MOTOR = True
except ImportError:
    AsyncIOMotorClient = None
    HAS_MOTOR = False
import aiosqlite

logger = logging.getLogger("database")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw[:72].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw[:72].encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _matches_filter(doc: dict, filter_dict: Optional[dict]) -> bool:
    if not filter_dict:
        return True
    for k, v in filter_dict.items():
        if k == "$or":
            if not any(_matches_filter(doc, sub) for sub in v):
                return False
            continue
        doc_val = doc.get(k)
        if isinstance(v, dict):
            for op, target in v.items():
                if op == "$in" and doc_val not in target:
                    return False
                elif op == "$nin" and doc_val in target:
                    return False
                elif op == "$ne" and doc_val == target:
                    return False
                elif op == "$gt" and not (doc_val is not None and doc_val > target):
                    return False
                elif op == "$gte" and not (doc_val is not None and doc_val >= target):
                    return False
                elif op == "$lt" and not (doc_val is not None and doc_val < target):
                    return False
                elif op == "$lte" and not (doc_val is not None and doc_val <= target):
                    return False
        elif doc_val != v:
            return False
    return True


def _apply_projection(doc: dict, projection: Optional[dict]) -> dict:
    if not projection:
        return dict(doc)
    
    # Check if projection is inclusion or exclusion
    has_inclusions = any(v for k, v in projection.items() if k != "_id" and v)
    
    if has_inclusions:
        res = {}
        for k, v in projection.items():
            if v and k in doc:
                res[k] = doc[k]
        if projection.get("_id") is False:
            res.pop("_id", None)
        return res
    else:
        res = dict(doc)
        for k, v in projection.items():
            if not v:
                res.pop(k, None)
        return res


class SQLiteCursor:
    def __init__(self, docs: List[dict], projection: Optional[dict] = None):
        self._docs = docs
        self._projection = projection
        self._sort_keys = []
        self._limit_n: Optional[int] = None
        self._skip_n: int = 0

    def sort(self, key_or_list, direction: int = 1):
        if isinstance(key_or_list, list):
            self._sort_keys = key_or_list
        else:
            self._sort_keys = [(key_or_list, direction)]
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    def skip(self, n: int):
        self._skip_n = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        docs = list(self._docs)
        if self._sort_keys:
            def sort_key(d):
                vals = []
                for k, direction in self._sort_keys:
                    val = d.get(k)
                    # Convert None or bools to comparable types
                    if val is None:
                        val = "" if direction > 0 else "\uffff"
                    vals.append(val)
                return vals

            # Python sorts ascending by default; handle multiple directions with type-safe key
            for k, direction in reversed(self._sort_keys):
                reverse = (direction == -1)
                def _key_fn(d, field=k):
                    v = d.get(field)
                    if v is None:
                        return (2, 0, "")
                    if isinstance(v, bool):
                        return (0, 0, int(v))
                    if isinstance(v, (int, float)):
                        return (0, 1, float(v))
                    return (1, 0, str(v))
                docs.sort(key=_key_fn, reverse=reverse)

        if self._skip_n:
            docs = docs[self._skip_n:]

        effective_limit = length if length is not None else self._limit_n
        if effective_limit is not None:
            docs = docs[:effective_limit]

        return [_apply_projection(d, self._projection) for d in docs]


class SQLiteCollection:
    """Async MongoDB-compatible collection backed by SQLite JSON storage."""
    def __init__(self, db_adapter: "DatabaseAdapter", name: str):
        self.db = db_adapter
        self.name = name

    async def find_one(self, filter: Optional[dict] = None, projection: Optional[dict] = None) -> Optional[dict]:
        docs = await self._load_all()
        for d in docs:
            if _matches_filter(d, filter):
                return _apply_projection(d, projection)
        return None

    def find(self, filter: Optional[dict] = None, projection: Optional[dict] = None) -> SQLiteCursor:
        filter_dict = filter or {}
        # Cursor will filter upon to_list
        async def fetch_matching():
            all_docs = await self._load_all()
            return [d for d in all_docs if _matches_filter(d, filter_dict)]

        cursor = SQLiteDeferredCursor(self, filter_dict, projection)
        return cursor

    async def insert_one(self, doc: dict):
        d = dict(doc)
        doc_id = str(d.get("id") or d.get("_id") or uuid.uuid4())
        d["id"] = d.get("id", doc_id)
        if "_id" not in d:
            d["_id"] = doc_id
        payload = json.dumps(d)
        async with self.db.conn.execute(
            "INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)",
            (self.name, doc_id, payload)
        ):
            await self.db.conn.commit()

        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc_id)

    async def update_one(self, filter: dict, update: dict, upsert: bool = False):
        all_docs = await self._load_all()
        target = None
        for d in all_docs:
            if _matches_filter(d, filter):
                target = d
                break

        if not target:
            if upsert:
                new_doc = dict(filter)
                if "$set" in update:
                    new_doc.update(update["$set"])
                if "$setOnInsert" in update:
                    new_doc.update(update["$setOnInsert"])
                await self.insert_one(new_doc)
                class UpsertResult:
                    modified_count = 1
                    upserted_id = new_doc.get("id")
                return UpsertResult()
            class NoopResult:
                modified_count = 0
            return NoopResult()

        if "$set" in update:
            target.update(update["$set"])
        if "$unset" in update:
            for k in update["$unset"]:
                target.pop(k, None)

        doc_id = str(target.get("id") or target.get("_id"))
        payload = json.dumps(target)
        async with self.db.conn.execute(
            "UPDATE documents SET data = ? WHERE collection = ? AND id = ?",
            (payload, self.name, doc_id)
        ):
            await self.db.conn.commit()

        class UpdateResult:
            modified_count = 1
        return UpdateResult()

    async def find_one_and_update(self, filter: dict, update: dict, return_document: bool = True, projection: Optional[dict] = None) -> Optional[dict]:
        all_docs = await self._load_all()
        target = None
        for d in all_docs:
            if _matches_filter(d, filter):
                target = d
                break

        if not target:
            return None

        before = dict(target)
        if "$set" in update:
            target.update(update["$set"])
        if "$unset" in update:
            for k in update["$unset"]:
                target.pop(k, None)

        doc_id = str(target.get("id") or target.get("_id"))
        payload = json.dumps(target)
        async with self.db.conn.execute(
            "UPDATE documents SET data = ? WHERE collection = ? AND id = ?",
            (payload, self.name, doc_id)
        ):
            await self.db.conn.commit()

        result = target if return_document else before
        return _apply_projection(result, projection)

    async def delete_one(self, filter: dict):
        all_docs = await self._load_all()
        target_id = None
        for d in all_docs:
            if _matches_filter(d, filter):
                target_id = str(d.get("id") or d.get("_id"))
                break

        if not target_id:
            class DeleteZero:
                deleted_count = 0
            return DeleteZero()

        async with self.db.conn.execute(
            "DELETE FROM documents WHERE collection = ? AND id = ?",
            (self.name, target_id)
        ):
            await self.db.conn.commit()

        class DeleteResult:
            deleted_count = 1
        return DeleteResult()

    async def count_documents(self, filter: Optional[dict] = None) -> int:
        all_docs = await self._load_all()
        if not filter:
            return len(all_docs)
        return sum(1 for d in all_docs if _matches_filter(d, filter))

    async def _load_all(self) -> List[dict]:
        async with self.db.conn.execute(
            "SELECT data FROM documents WHERE collection = ?",
            (self.name,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [json.loads(r[0]) for r in rows]


class SQLiteDeferredCursor:
    def __init__(self, collection: SQLiteCollection, filter_dict: dict, projection: Optional[dict]):
        self.collection = collection
        self.filter_dict = filter_dict
        self.projection = projection
        self._sort_keys = []
        self._limit_n: Optional[int] = None
        self._skip_n: int = 0

    def sort(self, key_or_list, direction: int = 1):
        if isinstance(key_or_list, list):
            self._sort_keys = key_or_list
        else:
            self._sort_keys = [(key_or_list, direction)]
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    def skip(self, n: int):
        self._skip_n = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        all_docs = await self.collection._load_all()
        matched = [d for d in all_docs if _matches_filter(d, self.filter_dict)]
        cursor = SQLiteCursor(matched, self.projection)
        if self._sort_keys:
            cursor.sort(self._sort_keys)
        if self._skip_n:
            cursor.skip(self._skip_n)
        effective_limit = length if length is not None else self._limit_n
        if effective_limit is not None:
            cursor.limit(effective_limit)
        return await cursor.to_list()


class DatabaseAdapter:
    """
    Unified async database adapter.
    Selects MongoDB if available and responding, otherwise uses a local SQLite store.
    """
    def __init__(self):
        self.mode: str = "sqlite"
        self.motor_client: Optional[AsyncIOMotorClient] = None
        self.motor_db = None
        self.conn: Optional[aiosqlite.Connection] = None
        self.collections: Dict[str, Any] = {}

    async def initialize(self):
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME", "smart_notes")

        # Attempt connecting to MongoDB with a short timeout
        if HAS_MOTOR and mongo_url:
            try:
                client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=1200)
                await client.admin.command("ping")
                self.motor_client = client
                self.motor_db = client[db_name]
                self.mode = "mongo"
                logger.info(f"Connected to MongoDB at {mongo_url}, database: {db_name}")
                return
            except Exception as e:
                logger.warning(f"MongoDB not available ({e}). Falling back to embedded SQLite store.")

        # Fallback to local SQLite
        self.mode = "sqlite"
        data_dir = Path(__file__).parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        db_path = data_dir / "notes.db"
        self.conn = await aiosqlite.connect(str(db_path))
        await self.conn.execute("PRAGMA journal_mode=WAL;")
        await self.conn.execute("PRAGMA synchronous=NORMAL;")
        await self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                collection TEXT NOT NULL,
                id TEXT NOT NULL,
                data TEXT NOT NULL,
                PRIMARY KEY (collection, id)
            )
            """
        )
        await self.conn.execute("CREATE INDEX IF NOT EXISTS idx_collection ON documents(collection)")
        await self.conn.commit()
        logger.info(f"Initialized local SQLite database at {db_path}")

    def __getattr__(self, name: str):
        if self.mode == "mongo" and self.motor_db is not None:
            return getattr(self.motor_db, name)
        if name not in self.collections:
            self.collections[name] = SQLiteCollection(self, name)
        return self.collections[name]

    def __getitem__(self, name: str):
        return self.__getattr__(name)

    async def close(self):
        if self.mode == "mongo" and self.motor_client:
            self.motor_client.close()
        elif self.conn:
            await self.conn.close()


db = DatabaseAdapter()


async def seed_demo_data():
    """Ensure standard demo account and starter notes exist."""
    demo_email = "demo@smartainotes.com"
    existing = await db.users.find_one({"email": demo_email})
    if existing:
        return

    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "name": "Demo User",
        "email": demo_email,
        "password_hash": hash_password("demo123!"),
        "created_at": now_iso(),
    })

    samples = [
        {
            "title": "Welcome to Ember",
            "content": "# Welcome to Ember\n\nEmber is a spark that helps ideas grow. Try the AI companion — type `/` anywhere in the editor for slash commands.\n\n- [x] Create first workspace\n- [ ] Try generating factual flashcards in Study Mode\n- [ ] Export note as a clean PDF\n- [ ] Explore the Ember Socratic Tutor\n\n> Ember is a spark that helps ideas grow.",
            "tags": ["welcome", "ember"],
            "pinned": True,
            "priority": "high",
        },
        {
            "title": "Product Roadmap 2026",
            "content": "## Core Pillars\n\n1. **Real-time collaboration**: live cursors, presence avatars, reader tracking.\n2. **AI Study Companion**: auto flashcards, MCQ quizzes with explanations.\n3. **Rich Text & Polish**: keyboard shortcuts, interactive checklists, clean multi-page export.",
            "tags": ["roadmap", "planning"],
            "pinned": False,
            "priority": "medium",
        },
    ]

    for i, s in enumerate(samples):
        await db.notes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "title": s["title"],
            "content": s["content"],
            "tags": s["tags"],
            "pinned": s["pinned"],
            "color": "default",
            "priority": s["priority"],
            "order": i,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    logger.info("Demo user and initial starter notes seeded successfully.")
