"""
Ember - Backend API Server
Production-ready FastAPI server with dual-mode database persistence,
real-time collaboration WebSockets, Ember AI writing partner, study mode, and auth.
"""
import os
import re
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any, Tuple
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from pydantic import BaseModel, Field, EmailStr
import jwt as pyjwt
from dotenv import load_dotenv

from database import db, seed_demo_data, hash_password, verify_password, now_iso
from websocket_manager import collab_manager
from ai_service import ai, parse_json_block, THINKING_PARTNER_SYSTEM, TUTOR_SYSTEM, FACILITATOR_SYSTEM

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---- Configuration ----
JWT_SECRET = os.environ.get("JWT_SECRET", "ember-jwt-secret-2026")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("server")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.initialize()
    await seed_demo_data()
    logger.info("Application startup complete.")
    yield
    await db.close()
    logger.info("Application shutdown complete.")

app = FastAPI(title="Ember API", version="2.0.0", lifespan=lifespan)
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ============= DATA SCHEMAS =============
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserPublic

class NoteCreate(BaseModel):
    title: Optional[str] = "Untitled"
    content: Optional[str] = ""
    tags: Optional[List[str]] = []
    pinned: Optional[bool] = False
    color: Optional[str] = "default"
    priority: Optional[Literal["none", "low", "medium", "high"]] = "none"

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None
    color: Optional[str] = None
    priority: Optional[Literal["none", "low", "medium", "high"]] = None

class Note(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    tags: List[str]
    pinned: bool
    color: str
    priority: str = "none"
    order: int
    created_at: str
    updated_at: str

class ReorderRequest(BaseModel):
    note_ids: List[str]

class StudySetSave(BaseModel):
    cards: Optional[List[Dict[str, Any]]] = []
    quiz: Optional[List[Dict[str, Any]]] = []

class MindMapSave(BaseModel):
    root: Optional[Dict[str, Any]] = None

class AIRequest(BaseModel):
    text: str
    note_id: Optional[str] = ""
    note_title: Optional[str] = ""
    note_context: Optional[str] = ""
    selected_text: Optional[str] = ""
    model: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None

class AIStreamRequest(BaseModel):
    prompt: str
    instruction: Optional[str] = ""
    note_id: Optional[str] = ""
    note_title: Optional[str] = ""
    note_context: Optional[str] = ""
    selected_text: Optional[str] = ""
    history: Optional[List[Dict[str, Any]]] = []
    mode: Optional[str] = "create"
    model: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None

class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    note_id: Optional[str] = ""
    note_title: Optional[str] = ""
    note_context: Optional[str] = ""
    selected_text: Optional[str] = ""
    history: Optional[List[Dict[str, Any]]] = []
    mode: Optional[str] = "create"
    model: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None

class AIFacilitateRequest(BaseModel):
    note_id: Optional[str] = ""
    note_title: Optional[str] = ""
    note_content: Optional[str] = ""
    comments: Optional[List[Dict[str, Any]]] = []
    activities: Optional[List[Dict[str, Any]]] = []
    prompt: Optional[str] = ""
    model: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None


class SearchRequest(BaseModel):
    query: str

class CommentCreate(BaseModel):
    text: str
    anchor_text: Optional[str] = ""

class ShareNoteRequest(BaseModel):
    email: str
    role: Optional[str] = "editor"

class EmberTutorRequest(BaseModel):
    message: str
    level: Optional[str] = "intermediate"  # eli5 | beginner | intermediate | advanced
    style: Optional[str] = "socratic"      # socratic | analogies | practice | knowledge_check | normal
    note_title: Optional[str] = ""
    note_context: Optional[str] = ""
    history: Optional[List[Dict[str, Any]]] = []
    model: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None

SparkTutorRequest = EmberTutorRequest


# ============= AUTH HELPERS =============
def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def public_user(u: dict) -> UserPublic:
    return UserPublic(
        id=u["id"],
        name=u.get("name", "User"),
        email=u.get("email", ""),
        created_at=u.get("created_at", now_iso())
    )


# ============= AUTH ENDPOINTS =============
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    email_clean = req.email.lower().strip()
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": req.name.strip(),
        "email": email_clean,
        "password_hash": hash_password(req.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return AuthResponse(token=make_token(uid), user=public_user(doc))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    email_clean = req.email.lower().strip()
    u = await db.users.find_one({"email": email_clean})
    if not u or not verify_password(req.password, u.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthResponse(token=make_token(u["id"]), user=public_user(u))

@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(current_user)):
    return public_user(user)


# ============= NOTES CRUD =============
async def _user_can_access_note(note_id: str, user: dict) -> Tuple[bool, Optional[dict], str]:
    """
    Check if user can access note.
    Returns (has_access, note_doc, role).
    Role is 'owner', 'editor', 'viewer', or 'none'.
    """
    note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        return False, None, "none"
    if note.get("user_id") == user["id"]:
        return True, note, "owner"
    
    # Check collaborators collection
    user_email = user.get("email", "").lower().strip()
    if user_email:
        collab = await db.collaborators.find_one({"note_id": note_id, "email": user_email}, {"_id": 0})
        if collab:
            return True, note, collab.get("role", "editor")
            
    return False, None, "none"

async def _next_order(user_id: str) -> int:
    cursor = db.notes.find({"user_id": user_id}, {"_id": 0, "order": 1}).sort("order", -1).limit(1)
    docs = await cursor.to_list(1)
    return (docs[0]["order"] + 1) if docs else 0

@api_router.post("/notes", response_model=Note)
async def create_note(payload: NoteCreate, user=Depends(current_user)):
    nid = str(uuid.uuid4())
    order = await _next_order(user["id"])
    doc = {
        "id": nid,
        "user_id": user["id"],
        "title": payload.title or "Untitled",
        "content": payload.content or "",
        "tags": payload.tags or [],
        "pinned": bool(payload.pinned),
        "color": payload.color or "default",
        "priority": payload.priority or "none",
        "order": order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.notes.insert_one(doc)
    doc.pop("_id", None)
    return Note(**doc)

@api_router.get("/notes", response_model=List[Note])
async def list_notes(user=Depends(current_user)):
    user_email = user.get("email", "").lower().strip()
    collab_note_ids = []
    if user_email:
        collab_docs = await db.collaborators.find({"email": user_email}, {"_id": 0, "note_id": 1}).to_list(500)
        collab_note_ids = [c["note_id"] for c in collab_docs if c.get("note_id")]

    if collab_note_ids:
        filter_query = {"$or": [{"user_id": user["id"]}, {"id": {"$in": collab_note_ids}}]}
    else:
        filter_query = {"user_id": user["id"]}

    cursor = db.notes.find(filter_query, {"_id": 0}).sort([("pinned", -1), ("order", 1), ("updated_at", -1)])
    docs = await cursor.to_list(2000)
    for d in docs:
        d.setdefault("priority", "none")
        d.setdefault("tags", [])
        d.setdefault("pinned", False)
        d.setdefault("color", "default")
    return [Note(**d) for d in docs]

@api_router.get("/notes/graph")
async def get_workspace_graph(user=Depends(current_user)):
    all_notes = await db.notes.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    nodes = []
    links = []
    note_entities = {}

    for n in all_notes:
        nid = n["id"]
        title = n.get("title") or "Untitled"
        content = n.get("content") or ""
        nodes.append({
            "id": nid,
            "title": title,
            "tags": n.get("tags") or [],
            "priority": n.get("priority", "none"),
            "color": n.get("color", "default"),
            "words": len(content.split()),
        })
        note_entities[nid] = {
            "title": title.lower(),
            "tags": set(n.get("tags") or []),
            "entities": set(ai._extract_core_entities(content + " " + title)),
            "content": content.lower(),
        }

    for i, n1 in enumerate(all_notes):
        id1 = n1["id"]
        d1 = note_entities[id1]
        for n2 in all_notes[i+1:]:
            id2 = n2["id"]
            d2 = note_entities[id2]

            weight = 0
            label = ""
            if d1["title"] and len(d1["title"]) > 3 and d1["title"] in d2["content"]:
                weight += 3
                label = "Mentions"
            elif d2["title"] and len(d2["title"]) > 3 and d2["title"] in d1["content"]:
                weight += 3
                label = "Mentions"

            st = d1["tags"].intersection(d2["tags"])
            if st:
                weight += len(st) * 2
                if not label:
                    label = f"#{list(st)[0]}"

            se = d1["entities"].intersection(d2["entities"])
            if len(se) >= 2:
                weight += len(se)
                if not label:
                    label = list(se)[0]

            if weight >= 2:
                links.append({
                    "source": id1,
                    "target": id2,
                    "weight": weight,
                    "label": label,
                })

    return {"nodes": nodes, "links": links}

@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str, user=Depends(current_user)):
    allowed, d, _ = await _user_can_access_note(note_id, user)
    if not allowed or not d:
        raise HTTPException(status_code=404, detail="Note not found")
    d.setdefault("priority", "none")
    d.setdefault("tags", [])
    d.setdefault("pinned", False)
    d.setdefault("color", "default")
    return Note(**d)

@api_router.patch("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, payload: NoteUpdate, user=Depends(current_user)):
    allowed, note_doc, role = await _user_can_access_note(note_id, user)
    if not allowed or not note_doc:
        raise HTTPException(status_code=404, detail="Note not found")
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewer cannot modify note")

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        note_doc.setdefault("priority", "none")
        return Note(**note_doc)

    update["updated_at"] = now_iso()
    res = await db.notes.find_one_and_update(
        {"id": note_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Note not found")
    res.setdefault("priority", "none")
    res.setdefault("tags", [])
    res.setdefault("pinned", False)
    res.setdefault("color", "default")
    return Note(**res)

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user=Depends(current_user)):
    res = await db.notes.delete_one({"id": note_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    # Clean up associated study set
    await db.study_sets.delete_one({"note_id": note_id})
    return {"ok": True}

@api_router.post("/notes/reorder")
async def reorder_notes(req: ReorderRequest, user=Depends(current_user)):
    now = now_iso()
    for idx, nid in enumerate(req.note_ids):
        await db.notes.update_one(
            {"id": nid, "user_id": user["id"]},
            {"$set": {"order": idx, "updated_at": now}},
        )
    return {"ok": True}

# ============= STUDY SET PERSISTENCE =============
@api_router.get("/notes/{note_id}/study")
async def get_study_set(note_id: str, user=Depends(current_user)):
    doc = await db.study_sets.find_one({"note_id": note_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        return {"cards": [], "quiz": []}
    return doc

@api_router.post("/notes/{note_id}/study")
async def save_study_set(note_id: str, payload: StudySetSave, user=Depends(current_user)):
    now = now_iso()
    doc = {
        "note_id": note_id,
        "user_id": user["id"],
        "cards": payload.cards or [],
        "quiz": payload.quiz or [],
        "updated_at": now,
    }
    await db.study_sets.update_one(
        {"note_id": note_id, "user_id": user["id"]},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "updated_at": now}

# ============= MIND MAP PERSISTENCE =============
@api_router.get("/notes/{note_id}/mindmap")
async def get_mindmap(note_id: str, user=Depends(current_user)):
    doc = await db.mind_maps.find_one({"note_id": note_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        return {"root": None}
    return doc

@api_router.post("/notes/{note_id}/mindmap")
async def save_mindmap(note_id: str, payload: MindMapSave, user=Depends(current_user)):
    now = now_iso()
    doc = {
        "note_id": note_id,
        "user_id": user["id"],
        "root": payload.root,
        "updated_at": now,
    }
    await db.mind_maps.update_one(
        {"note_id": note_id, "user_id": user["id"]},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "updated_at": now}

# ============= NOTE CONNECTIONS & WORKSPACE GRAPH =============
@api_router.get("/notes/{note_id}/connections")
async def get_note_connections(note_id: str, user=Depends(current_user)):
    target = await db.notes.find_one({"id": note_id, "user_id": user["id"]}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Note not found")

    all_notes = await db.notes.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    target_tags = set(target.get("tags") or [])
    target_title = (target.get("title") or "").lower().strip()
    target_text = (target.get("content") or "") + " " + (target.get("title") or "")
    target_entities = set(ai._extract_core_entities(target_text))

    connections = []
    for n in all_notes:
        if n["id"] == note_id:
            continue
        n_title = (n.get("title") or "").lower().strip()
        n_tags = set(n.get("tags") or [])
        n_content = n.get("content") or ""
        n_entities = set(ai._extract_core_entities(n_content + " " + n_title))

        reasons = []
        score = 0

        # Direct reference or title mention
        if target_title and len(target_title) > 3 and target_title in n_content.lower():
            reasons.append(f"Referenced in '{n.get('title')}'")
            score += 50
        if n_title and len(n_title) > 3 and n_title in target.get("content", "").lower():
            reasons.append(f"References '{n.get('title')}'")
            score += 50

        # Shared tags
        shared_tags = target_tags.intersection(n_tags)
        if shared_tags:
            reasons.append(f"Shared tags: {', '.join(list(shared_tags)[:3])}")
            score += len(shared_tags) * 20

        # Common core entities / concepts
        shared_entities = target_entities.intersection(n_entities)
        if shared_entities:
            reasons.append(f"Common topics: {', '.join(list(shared_entities)[:3])}")
            score += len(shared_entities) * 12

        if score > 0:
            connections.append({
                "id": n["id"],
                "title": n.get("title") or "Untitled",
                "snippet": n_content[:160],
                "score": score,
                "reasons": reasons,
                "tags": list(n_tags),
                "updated_at": n.get("updated_at"),
            })

    connections.sort(key=lambda x: x["score"], reverse=True)
    return {"connections": connections[:10]}


# ============= AI ASSISTANT ENDPOINTS =============
@api_router.get("/ai/status")
async def ai_status():
    """Return status of configured AI providers and models."""
    prov, _ = ai.resolve_credentials()
    return {
        "active_provider": prov,
        "providers_available": {
            "gemini": bool(ai.gemini_key),
            "anthropic": bool(ai.anthropic_key),
            "openai": bool(ai.openai_key),
            "local": True,
        },
        "default_models": {
            "gemini": "gemini-2.0-flash",
            "anthropic": "claude-3-5-sonnet-20241022",
            "openai": "gpt-4o-mini",
            "local": "smart-semantic-engine-v2",
        },
        "streaming_supported": True,
    }

async def _get_linked_notes_context(note_id: str, user: dict) -> List[Dict[str, Any]]:
    """
    Principle Zero: Only retrieve linked notes if user explicitly has access to the current note
    and only search among notes owned by this user.
    """
    if not note_id:
        return []
    allowed, curr_note, _ = await _user_can_access_note(note_id, user)
    if not allowed or not curr_note:
        return []
    all_notes = await db.notes.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    
    title1 = (curr_note.get("title") or "").strip().lower()
    content1 = (curr_note.get("content") or "").strip().lower()
    tags1 = set(curr_note.get("tags") or [])
    entities1 = set(ai._extract_core_entities(content1 + " " + title1))
    
    scored = []
    for n in all_notes:
        nid = n.get("id")
        if nid == note_id:
            continue
        title2 = (n.get("title") or "").strip().lower()
        content2 = (n.get("content") or "").strip().lower()
        tags2 = set(n.get("tags") or [])
        entities2 = set(ai._extract_core_entities(content2 + " " + title2))
        
        weight = 0
        label = ""
        if title1 and len(title1) > 3 and title1 in content2:
            weight += 3
            label = f"Mentions '{curr_note.get('title')}'"
        elif title2 and len(title2) > 3 and title2 in content1:
            weight += 3
            label = f"Mentions '{n.get('title')}'"
        
        st = tags1.intersection(tags2)
        if st:
            weight += len(st) * 2
            if not label:
                label = f"Shared tag #{list(st)[0]}"
        
        se = entities1.intersection(entities2)
        if len(se) >= 2:
            weight += len(se)
            if not label:
                label = f"Shared concept: {list(se)[0]}"
        
        if weight >= 2:
            scored.append({
                "id": nid,
                "title": n.get("title", "Untitled"),
                "snippet": (n.get("content") or "")[:200],
                "weight": weight,
                "connection": label,
            })
    
    scored.sort(key=lambda x: x["weight"], reverse=True)
    return scored[:3]

@api_router.post("/ai/stream")
async def ai_stream(req: AIStreamRequest, user=Depends(current_user)):
    """Live Server-Sent Events (SSE) token stream for real-time thinking partner generation."""
    if req.note_id:
        allowed, _, _ = await _user_can_access_note(req.note_id, user)
        if not allowed:
            raise HTTPException(status_code=403, detail="Principle Zero Violation: Access to note context denied.")

    linked_notes = await _get_linked_notes_context(req.note_id, user) if req.note_id else []
    instruction_line = f"Special Instruction: {req.instruction}\n" if req.instruction else ""
    user_request_part = f"[USER INQUIRY / TASK]:\n{req.prompt}\n{instruction_line}".strip()

    context_blocks = []
    if req.note_title:
        context_blocks.append(f"Active Document Title: '{req.note_title}'")
    if req.selected_text:
        context_blocks.append(f"User Highlighted / Selected Text:\n\"{req.selected_text}\"")
    if req.note_context:
        context_blocks.append(f"Active Document Content:\n{req.note_context}")
    if linked_notes:
        links_desc = "\n".join([f"- [[{ln['title']}]]: {ln['connection']} (Excerpt: {ln['snippet'][:120]}...)" for ln in linked_notes])
        context_blocks.append(f"Related Workspace Notes:\n{links_desc}")

    if context_blocks:
        context_section = (
            "\n\n[WORKSPACE CONTEXT]\n"
            "(Instruction: First evaluate if this context is relevant to the [USER INQUIRY]. "
            "If the user asks an independent question, general concept, coding task, or reasoning query that does not depend on this note, "
            "answer the user directly and DO NOT force links or summaries of this context.)\n"
            + "\n\n".join(context_blocks)
        )
        prompt = f"{user_request_part}{context_section}"
    else:
        prompt = user_request_part

    mode = (req.mode or "create").lower()
    if mode == "study":
        system = TUTOR_SYSTEM
    elif mode == "collab":
        system = FACILITATOR_SYSTEM
    else:
        system = THINKING_PARTNER_SYSTEM

    async def event_generator():
        try:
            async for token in ai.generate_stream(
                system, prompt, req.provider, req.api_key, req.model,
                note_title=req.note_title or "",
                note_context=req.note_context or "",
                selected_text=req.selected_text or "",
                history=req.history or [],
                mode=mode,
                linked_notes=linked_notes,
                user_prompt=req.prompt,
            ):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@api_router.post("/ai/facilitate")
async def ai_facilitate(req: AIFacilitateRequest, user=Depends(current_user)):
    """Synthesize team discussion, comments, and activities into clear consensus and actionable next steps."""
    comments = req.comments or []
    activities = req.activities or []
    if req.note_id and not comments:
        c_cursor = db.comments.find({"note_id": req.note_id}, {"_id": 0}).sort("created_at", 1)
        comments = await c_cursor.to_list(50)
    if req.note_id and not activities:
        a_cursor = db.activities.find({"note_id": req.note_id}, {"_id": 0}).sort("created_at", -1)
        activities = await a_cursor.to_list(30)
    
    prompt = (
        f"Document Title: '{req.note_title}'\n"
        f"Document Context:\n{req.note_content}\n\n"
        f"Collaborator Comments:\n{json.dumps(comments)}\n\n"
        f"Recent Activities:\n{json.dumps(activities)}\n\n"
        "Synthesize this team discussion. Highlight key areas of team alignment, unresolved debates or collaborator comments, "
        "and a clear action checklist to finalize the document."
    )
    res = await ai.generate_text(FACILITATOR_SYSTEM, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_facilitate(
            req.note_title or "",
            req.note_content or "",
            comments=comments,
            activities=activities,
            custom_prompt=req.prompt or "",
        )
    return {"result": res, "synthesis": res}

@api_router.post("/ai/continue")
async def ai_continue(req: AIRequest, user=Depends(current_user)):
    title_ctx = f" (Title: '{req.note_title}')" if req.note_title else ""
    ctx = req.note_context or req.text
    prompt = (
        f"Document Title: '{req.note_title}'\n"
        f"Document so far:\n{ctx}\n\n"
        "Continue writing seamlessly from this exact point, advancing the core thesis and maintaining voice. "
        "Do not repeat earlier text. Output ONLY the continuation text."
    )
    sys = (
        f"You are a sophisticated intellectual co-writer inside Ember{title_ctx}. "
        "Continue the user's note directly in their voice, developing their thesis with substantive depth, "
        "nuance, and precision. Output ONLY the continuation text — no preface, no quotes."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_continue(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/improve")
async def ai_improve(req: AIRequest, user=Depends(current_user)):
    prompt = f"Document Title: '{req.note_title}'\nText to improve:\n{req.text}\n\nRewrite to be sharp, polished, vivid, and impeccable while preserving technical precision and markdown structure."
    sys = (
        "You are an elite prose editor (inspired by the best non-fiction publishing). "
        "Rewrite the text to be sharp, polished, vivid, and grammatically impeccable. "
        "Preserve the author's core thesis and voice while eliminating fluff and passive drag. "
        "Output ONLY the rewritten text."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_improve(req.text)
    return {"result": res}

@api_router.post("/ai/summarize")
async def ai_summarize(req: AIRequest, user=Depends(current_user)):
    prompt = f"Document Title: '{req.note_title}'\nContent to summarize:\n{req.text}\n\nSynthesize this note into an executive summary."
    sys = (
        "Produce a tight, high-signal executive summary capturing the primary thesis, "
        "governing mechanics, and strategic bottom line. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_summarize(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/bullets")
async def ai_bullets(req: AIRequest, user=Depends(current_user)):
    prompt = f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\nConvert into clean structured bullet points with bold leading concepts."
    sys = (
        "Convert the text into clean, structured markdown bullet points. "
        "Use bold leading concepts for each bullet (e.g. '- **Concept**: explanation'). Output ONLY the bullets."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_bullets(req.text)
    return {"result": res}

@api_router.post("/ai/keypoints")
async def ai_keypoints(req: AIRequest, user=Depends(current_user)):
    prompt = f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\nExtract 5-8 essential insights as a markdown bulleted list."
    sys = (
        "Extract 5-8 essential insights from this note as a markdown bulleted list. "
        "Each bullet must be a self-contained, high-leverage realization. Output ONLY the bullets."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_keypoints(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/counter")
async def ai_counter(req: AIRequest, user=Depends(current_user)):
    """Uncover blind spots, counter-perspectives, and challenges to the note's ideas."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent to critique:\n{req.text}\n\n"
        "Analyze these ideas and provide a rigorous critique across: "
        "(1) Foundational premises and boundary conditions, "
        "(2) Steelmanned alternative thesis, "
        "(3) Unintended second-order effects, "
        "(4) Empirical falsification stress tests. "
        "Be substantive, analytical, and structured in markdown."
    )
    sys = (
        "Act as a constructive intellectual sparring partner. Analyze the note's premises and present "
        "deep counter-perspectives, potential edge cases, blind spots, or alternative hypotheses. "
        "Be rigorous, respectful, and stimulating. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_counterarguments(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/actions")
async def ai_actions(req: AIRequest, user=Depends(current_user)):
    """Extract concrete, high-leverage action items as an interactive checklist."""
    prompt = f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\nExtract concrete, high-leverage action items as a markdown checklist ('- [ ] **Action**: detail')."
    sys = (
        "Extract all actionable next steps, decisions, and tasks implied by the note as a markdown checklist "
        "('- [ ] **Action**: detail'). Focus on immediate high-leverage execution. Output ONLY the checklist."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_action_items(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/mindmap")
async def ai_mindmap(req: AIRequest, user=Depends(current_user)):
    """Extract a visual hierarchical concept mind map tree."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\n"
        "Extract a hierarchical concept mind map tree from this document. "
        "Include a root node, 3-4 main branches, and 2-4 focused child sub-nodes per branch with brief summaries. "
        'Respond ONLY in valid JSON as: {"root":{"id":"root","label":"...","summary":"...","children":[{"id":"b1","label":"...","summary":"...","children":[{"id":"b1_1","label":"...","summary":"..."}]}]}}'
    )
    sys = "You are a concept visualizer and structural ontologist. Return clean JSON representing the document's conceptual tree."
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    parsed = parse_json_block(res) if res else None
    if not parsed or not isinstance(parsed, dict) or not parsed.get("root"):
        parsed = ai.fallback_mindmap(req.text, req.note_title or "")
    return parsed

@api_router.post("/ai/flashcards")
async def ai_flashcards(req: AIRequest, user=Depends(current_user)):
    prompt = (
        f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\n"
        "Generate 6-8 rigorous study flashcards directly based on the note's concrete facts, definitions, mechanics, and numbers. "
        'Respond ONLY in valid JSON format as: {"cards":[{"q":"...","a":"...","category":"..."}]}'
    )
    sys = (
        "You are Ember Study Engine. Generate 6-8 concrete, high-yield study flashcards grounded 100% in the note. "
        'Respond ONLY in valid JSON format as: {"cards":[{"q":"...","a":"...","category":"..."}]}. '
        "Questions must test active recall of factual definitions, key steps, and mechanisms. Answers must be direct, specific, and factual."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    parsed = parse_json_block(res) if res else None
    if not parsed or not isinstance(parsed, dict) or not parsed.get("cards"):
        parsed = {"cards": ai.fallback_flashcards(req.text, req.note_title or "")}
    return parsed

@api_router.post("/ai/quiz")
async def ai_quiz(req: AIRequest, user=Depends(current_user)):
    prompt = (
        f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\n"
        "Generate a 5-question multiple choice quiz testing core facts, definitions, and mechanisms from the text. "
        'Respond ONLY in valid JSON as: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"explanation":"..."}]}'
    )
    sys = (
        "You are Ember Study Engine. Generate a 5-question factual multiple choice quiz grounded directly in the note. "
        'Respond ONLY in valid JSON as: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"explanation":"..."}]}. '
        "answer is the 0-based index of the correct option. Distractors must be plausible alternatives from the same domain. "
        "Provide a clear, factual explanation citing the note."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    parsed = parse_json_block(res) if res else None
    if not parsed or not isinstance(parsed, dict) or not parsed.get("questions"):
        parsed = {"questions": ai.fallback_quiz(req.text, req.note_title or "")}
    return parsed

@api_router.post("/ai/assumptions")
async def ai_assumptions(req: AIRequest, user=Depends(current_user)):
    """Uncover hidden assumptions, unspoken premises, and boundary risks in the note."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent to analyze:\n{req.text}\n\n"
        "Uncover 3-4 foundational unspoken assumptions and boundary conditions in this text. "
        "For each assumption, explain what breaks if it is invalidated."
    )
    sys = (
        "You are an analytical philosopher and systems architect inside Ember. "
        "Deconstruct the text's underlying premises with precision. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_assumptions(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/perspective")
async def ai_perspective(req: AIRequest, user=Depends(current_user)):
    """Frame the note from contrasting paradigms (First Principles, Systems, Adversary, Practitioner)."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent to re-frame:\n{req.text}\n\n"
        "Analyze this note through 3 contrasting cognitive paradigms: First Principles, Systems Ecology, and Pragmatic Implementation."
    )
    sys = (
        "You are a multidisciplinary cognitive strategist inside Ember. "
        "Re-frame the topic through contrasting high-order paradigms. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_perspective(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/missing")
async def ai_missing(req: AIRequest, user=Depends(current_user)):
    """Identify blind spots, overlooked edge cases, and omitted critical context."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\n"
        "Identify 3-4 critical pieces of missing information, unaddressed variables, or overlooked edge cases."
    )
    sys = (
        "You are an investigative reviewer inside Ember. Highlight omissions and blind spots with rigor. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_missing(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/research")
async def ai_research(req: AIRequest, user=Depends(current_user)):
    """Generate high-yield research directions, empirical probes, and literature questions."""
    prompt = (
        f"Document Title: '{req.note_title}'\nContent:\n{req.text}\n\n"
        "Generate 4-5 high-yield research questions and empirical investigations to deepen this document."
    )
    sys = (
        "You are a research mentor inside Ember. Formulate precise, falsifiable research inquiries. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_research(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/expand")
async def ai_expand(req: AIRequest, user=Depends(current_user)):
    """Expand selected concept with mechanisms, real-world examples, and boundary nuances."""
    prompt = (
        f"Document Title: '{req.note_title}'\nConcept or text to expand:\n{req.text}\n\n"
        "Expand this concept with deeper mechanical explanations, concrete examples, and boundary subtleties."
    )
    sys = (
        "You are an expert encyclopedic analyst inside Ember. Deepen the explanation while remaining articulate and concise."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_expand(req.text, req.note_title or "")
    return {"result": res}

@api_router.post("/ai/tutor")
async def ai_tutor(req: EmberTutorRequest, user=Depends(current_user)):
    """Multi-depth, multi-style Ember Socratic Tutor supporting general & note concepts."""
    level = req.level or "intermediate"
    style = req.style or "socratic"
    prompt = (
        f"Student Query: '{req.message}'\n"
        f"Depth Level: {level} (eli5, beginner, intermediate, advanced)\n"
        f"Teaching Style: {style} (socratic, analogies, practice, knowledge_check, normal)\n"
        f"Document Title: '{req.note_title}'\n"
        f"Document Context:\n{req.note_context}\n\n"
        "Answer the student query according to the requested depth level and style. "
        "If the question is about a general computer science, science, or philosophical concept, answer it thoroughly even if not in the note. "
        "If it refers to the note, ground your explanation in the note's specifics."
    )
    sys = (
        f"You are Ember Tutor, an elite Socratic tutor inside Ember. "
        f"You teach at depth level: '{level}' using style: '{style}'. "
        "Ground your answers in concrete facts, definitions, and precise mechanisms. Output clean markdown."
    )
    res = await ai.generate_text(sys, prompt, req.provider, req.api_key, req.model)
    if res:
        return {"reply": res, "mode": "llm", "level": level, "style": style}
    
    return ai.fallback_tutor(
        message=req.message,
        note_title=req.note_title or "",
        note_context=req.note_context or "",
        level=level,
        style=style,
    )

@api_router.post("/ai/chat")
async def ai_chat(req: AIChatRequest, user=Depends(current_user)):
    sid = req.session_id or str(uuid.uuid4())
    linked_notes = []
    if req.note_id:
        allowed, _, _ = await _user_can_access_note(req.note_id, user)
        if not allowed:
            raise HTTPException(status_code=403, detail="Principle Zero Violation: Access to note context denied.")
        linked_notes = await _get_linked_notes_context(req.note_id, user)

    mode = (req.mode or "create").lower()
    if mode == "study":
        sys_base = TUTOR_SYSTEM
    elif mode == "collab":
        sys_base = FACILITATOR_SYSTEM
    else:
        sys_base = THINKING_PARTNER_SYSTEM

    context_blocks = []
    if req.note_title:
        context_blocks.append(f"Active Document Title: '{req.note_title}'")
    if req.selected_text:
        context_blocks.append(f"User Highlighted / Selected Text:\n\"{req.selected_text}\"")
    if req.note_context:
        context_blocks.append(f"Active Document Content:\n{req.note_context}")
    if linked_notes:
        ln_str = "\n".join([f"- Note '{ln['title']}': {ln['snippet']} (Relevance: {ln.get('connection', 'Related')})" for ln in linked_notes])
        context_blocks.append(f"Related Workspace Knowledge / Linked Notes:\n{ln_str}")

    context_section = ""
    if context_blocks:
        context_section = (
            "\n\n[ACTIVE WORKSPACE CONTEXT]\n"
            "(Instruction: Evaluate relevance first. If the user asks an independent general question, coding task, or reasoning inquiry, "
            "answer directly using general intelligence and do not force references or summaries of this context.)\n"
            + "\n\n".join(context_blocks)
        )

    sys = f"{sys_base}\n{context_section}\n\nBe analytical, clear, and direct. Avoid conversational filler, empty praise, or artificial formalities."
    res = await ai.generate_text(sys, req.message, req.provider, req.api_key, req.model)
    if not res:
        res = ai.fallback_chat(
            req.message,
            req.note_context or "",
            req.note_title or "",
            linked_notes=linked_notes,
            history=req.history,
        )

    # Persist conversation
    now = now_iso()
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": sid,
        "role": "user",
        "content": req.message,
        "created_at": now,
    })
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": sid,
        "role": "assistant",
        "content": res,
        "created_at": now,
    })
    return {"reply": res, "session_id": sid}

@api_router.post("/ai/search")
async def ai_search(req: SearchRequest, user=Depends(current_user)):
    q = req.query.strip()
    if not q:
        return {"results": []}
    notes = await db.notes.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    if not notes:
        return {"results": []}

    terms = [t.lower() for t in re.split(r"\s+", q) if t]
    scored = []
    for n in notes:
        title = (n.get("title") or "").lower()
        content = (n.get("content") or "").lower()
        tags = [t.lower() for t in n.get("tags", [])]
        
        # Scoring weight: title matches weighted x3, tags x2, content x1
        score = sum(title.count(t) * 3 + sum(tag.count(t) * 2 for tag in tags) + content.count(t) for t in terms)
        if score > 0:
            scored.append((score, n))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [n for _, n in scored[:10]]

    # If keyword matching yielded no hits, attempt semantic match
    if not top and len(notes) > 0:
        top = notes[:5]

    results = []
    for n in top:
        text = n.get("content", "")
        snippet = text[:200]
        for t in terms:
            idx = text.lower().find(t)
            if idx >= 0:
                start = max(0, idx - 60)
                snippet = text[start:start + 220]
                break
        results.append({
            "id": n["id"],
            "title": n.get("title", "Untitled"),
            "snippet": snippet or "No preview available",
            "tags": n.get("tags", []),
            "updated_at": n.get("updated_at"),
        })
    return {"results": results}


# ============= EMBER CONTEXT-AWARE INSIGHT SYSTEM =============
def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

async def _compute_ember_insight(user_id: str, offset: int = 0) -> Dict[str, Any]:
    notes = []
    if user_id and user_id != "guest":
        cursor = db.notes.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1)
        notes = await cursor.to_list(20)
    
    insight = ai.fallback_workspace_insight(notes, seed_offset=offset)
    category = insight.get("category") or insight.get("title") or "Creative Reflection"
    author_str = f"Ember · {category}"
    return {
        **insight,
        "category": category,
        "author": author_str,
        "action_label": "Reflect on this",
        "context_tag": insight.get("source_context", "Reflective Ember"),
        "q": insight.get("prompt", ""),
        "a": author_str,
        "offset": offset,
        "personalized": False,
    }

_compute_spark_insight = _compute_ember_insight

@api_router.get("/insights/daily")
@api_router.get("/quote")
async def daily_insight(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    user_id = "guest"
    if creds:
        try:
            payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
            user_id = payload.get("sub", "guest")
        except Exception:
            pass

    today = _today_key()
    cached = await db.daily_quotes.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    if cached and "insight" in cached and isinstance(cached["insight"], dict) and cached["insight"].get("source_context") == "Reflective Ember":
        ins = cached["insight"]
        cat = ins.get("category") or ins.get("title") or "Creative Reflection"
        author_str = ins.get("author") or f"Ember · {cat}"
        return {
            **ins,
            "category": cat,
            "title": ins.get("title", cat),
            "author": author_str,
            "action_label": ins.get("action_label", "Reflect on this"),
            "context_tag": ins.get("context_tag", "Reflective Ember"),
            "q": ins.get("prompt", cached.get("q", "")),
            "a": author_str,
            "personalized": cached.get("personalized", False),
            "offset": cached.get("offset", 0),
        }

    data = await _compute_ember_insight(user_id, offset=0)
    await db.daily_quotes.update_one(
        {"user_id": user_id, "date": today},
        {
            "$set": {
                "user_id": user_id,
                "date": today,
                "offset": 0,
                "insight": data,
                "q": data["q"],
                "a": data["a"],
                "personalized": data["personalized"],
            }
        },
        upsert=True,
    )
    return data

@api_router.post("/insights/refresh")
@api_router.post("/quote/refresh")
async def refresh_insight(user=Depends(current_user)):
    today = _today_key()
    cached = await db.daily_quotes.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
    curr_offset = (cached.get("offset", 0) if cached else 0) + 1

    data = await _compute_ember_insight(user["id"], offset=curr_offset)
    await db.daily_quotes.update_one(
        {"user_id": user["id"], "date": today},
        {
            "$set": {
                "user_id": user["id"],
                "date": today,
                "offset": curr_offset,
                "insight": data,
                "q": data["q"],
                "a": data["a"],
                "personalized": data["personalized"],
            }
        },
        upsert=True,
    )
    return data


# ============= NOTE COMMENTS =============
@api_router.get("/notes/{note_id}/comments")
async def list_note_comments(note_id: str, user=Depends(current_user)):
    allowed, _, _ = await _user_can_access_note(note_id, user)
    if not allowed:
        raise HTTPException(status_code=404, detail="Note not found")
    cursor = db.comments.find({"note_id": note_id}, {"_id": 0}).sort("created_at", 1)
    docs = await cursor.to_list(100)
    return {"comments": docs}

@api_router.post("/notes/{note_id}/comments")
async def create_note_comment(note_id: str, payload: CommentCreate, user=Depends(current_user)):
    allowed, _, role = await _user_can_access_note(note_id, user)
    if not allowed:
        raise HTTPException(status_code=404, detail="Note not found")
    cid = str(uuid.uuid4())
    now = now_iso()
    doc = {
        "id": cid,
        "note_id": note_id,
        "user_id": user["id"],
        "user_name": user.get("name", "User"),
        "user_email": user.get("email", ""),
        "text": payload.text.strip(),
        "anchor_text": payload.anchor_text or "",
        "resolved": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    await db.activities.insert_one({
        "id": str(uuid.uuid4()),
        "note_id": note_id,
        "user_id": user["id"],
        "user_name": user.get("name", "User"),
        "type": "comment_added",
        "description": f"Added a comment: \"{payload.text[:40]}\"",
        "created_at": now,
    })
    return doc

@api_router.delete("/notes/{note_id}/comments/{comment_id}")
async def delete_note_comment(note_id: str, comment_id: str, user=Depends(current_user)):
    allowed, _, role = await _user_can_access_note(note_id, user)
    if not allowed:
        raise HTTPException(status_code=404, detail="Note not found")
    comm = await db.comments.find_one({"id": comment_id, "note_id": note_id}, {"_id": 0})
    if not comm:
        return {"ok": True}
    if comm.get("user_id") != user["id"] and role != "owner":
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    await db.comments.delete_one({"id": comment_id, "note_id": note_id})
    return {"ok": True}

# ============= NOTE ACTIVITY FEED =============
@api_router.get("/notes/{note_id}/activity")
async def get_note_activity(note_id: str, user=Depends(current_user)):
    allowed, note_doc, _ = await _user_can_access_note(note_id, user)
    if not allowed or not note_doc:
        raise HTTPException(status_code=404, detail="Note not found")
    cursor = db.activities.find({"note_id": note_id}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(50)
    if not docs:
        docs = [{
            "id": "created",
            "note_id": note_id,
            "user_name": user.get("name", "Author"),
            "type": "note_created",
            "description": f"Created note '{note_doc.get('title', 'Untitled')}'",
            "created_at": note_doc.get("created_at", now_iso()),
        }]
    return {"activities": docs}

# ============= WORKSPACE COLLABORATORS & SHARING =============
@api_router.get("/notes/{note_id}/collaborators")
async def get_note_collaborators(note_id: str, user=Depends(current_user)):
    allowed, _, _ = await _user_can_access_note(note_id, user)
    if not allowed:
        raise HTTPException(status_code=404, detail="Note not found")
    cursor = db.collaborators.find({"note_id": note_id}, {"_id": 0})
    shared = await cursor.to_list(50)
    return {"collaborators": shared}

@api_router.post("/notes/{note_id}/share")
async def share_note(note_id: str, payload: ShareNoteRequest, user=Depends(current_user)):
    allowed, note_doc, role = await _user_can_access_note(note_id, user)
    if not allowed or not note_doc:
        raise HTTPException(status_code=404, detail="Note not found")
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only note owner can share this note")

    email_clean = payload.email.lower().strip()
    collab_id = str(uuid.uuid4())
    now = now_iso()
    doc = {
        "id": collab_id,
        "note_id": note_id,
        "email": email_clean,
        "role": payload.role or "editor",
        "shared_by": user["id"],
        "shared_by_name": user.get("name", "User"),
        "created_at": now,
    }
    await db.collaborators.update_one(
        {"note_id": note_id, "email": email_clean},
        {"$set": doc},
        upsert=True
    )
    await db.activities.insert_one({
        "id": str(uuid.uuid4()),
        "note_id": note_id,
        "user_id": user["id"],
        "user_name": user.get("name", "User"),
        "type": "note_shared",
        "description": f"Shared note with {email_clean} ({payload.role or 'editor'})",
        "created_at": now,
    })
    return {"ok": True, "collaborator": doc}


# ============= REAL-TIME WEBSOCKET COLLABORATION =============
async def _handle_collab_websocket(websocket: WebSocket, note_id: str):
    token = websocket.query_params.get("token")
    user = None
    if token:
        try:
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            user_doc = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
            if user_doc:
                user = user_doc
        except Exception:
            pass

    if not user:
        anon_id = str(uuid.uuid4())[:6]
        user = {"id": f"guest_{anon_id}", "name": f"Guest {anon_id}"}

    await collab_manager.connect(websocket, note_id, user)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            mtype = data.get("type")
            if mtype == "cursor":
                await collab_manager.handle_cursor_move(websocket, data)
            elif mtype == "edit":
                await collab_manager.handle_note_edit(websocket, data)
            elif mtype == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except (WebSocketDisconnect, Exception):
        await collab_manager.disconnect(websocket)

@api_router.websocket("/ws/notes/{note_id}")
async def api_websocket_endpoint(websocket: WebSocket, note_id: str):
    await _handle_collab_websocket(websocket, note_id)

@app.websocket("/ws/notes/{note_id}")
async def root_websocket_endpoint(websocket: WebSocket, note_id: str):
    await _handle_collab_websocket(websocket, note_id)


# ============= HEALTH & ROOT =============
@api_router.get("/")
async def api_root():
    return {"message": "Ember API", "ok": True, "db_mode": db.mode}

@app.get("/")
async def app_root():
    return {"message": "Ember API", "ok": True, "db_mode": db.mode}


# ============= MIDDLEWARE & LIFECYCLE =============
app.include_router(api_router)

cors_origins_raw = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_raw.strip() == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True if "*" not in cors_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

