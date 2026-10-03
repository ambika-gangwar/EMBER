"""
Smart AI Notes - Comprehensive Backend API & Realtime Tests
Runs using FastAPI TestClient in-process, verifying all endpoints:
Auth, Notes CRUD, Study Sets, AI Assistant, and WebSockets.
"""
import os
import uuid
import pytest
from fastapi.testclient import TestClient

from server import app

DEMO_EMAIL = "demo@smartainotes.com"
DEMO_PASSWORD = "demo123!"

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def demo_token(client):
    r = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="session")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, client):
        r = client.get("/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "message" in data

    def test_spark_insights_and_refresh(self, client, auth_headers):
        # 1. Daily insight GET endpoint (and /api/quote alias)
        r = client.get("/api/insights/daily", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "prompt" in data and "category" in data and "type" in data
        assert "q" in data and "a" in data
        assert isinstance(data["prompt"], str) and len(data["prompt"]) > 0

        # Verify backward compatible /api/quote
        r_quote = client.get("/api/quote", headers=auth_headers)
        assert r_quote.status_code == 200
        assert r_quote.json()["prompt"] == data["prompt"]

        initial_offset = data.get("offset", 0)

        # 2. Refresh insight POST endpoint
        r_ref = client.post("/api/insights/refresh", headers=auth_headers)
        assert r_ref.status_code == 200
        ref_data = r_ref.json()
        assert "prompt" in ref_data
        assert ref_data.get("offset") == initial_offset + 1
        assert ref_data["prompt"] != data["prompt"] or ref_data["category"] != data["category"]

        # 3. Verify /api/quote/refresh alias
        r_ref_alias = client.post("/api/quote/refresh", headers=auth_headers)
        assert r_ref_alias.status_code == 200
        assert r_ref_alias.json().get("offset") == initial_offset + 2


# ---------- Auth ----------
class TestAuth:
    def test_login_demo(self, client):
        r = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["email"] == DEMO_EMAIL
        assert "id" in data["user"]

    def test_login_invalid(self, client):
        r = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": "wrongpassword"})
        assert r.status_code == 401

    def test_signup_and_me(self, client):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = client.post("/api/auth/signup", json={"name": "Test User", "email": email, "password": "pass1234password"})
        assert r.status_code == 200, r.text
        data = r.json()
        token = data["token"]
        assert data["user"]["email"] == email

        # /auth/me
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

        # Duplicate signup
        dup = client.post("/api/auth/signup", json={"name": "Test User", "email": email, "password": "pass1234password"})
        assert dup.status_code == 400

    def test_me_requires_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code in (401, 403)


# ---------- Notes CRUD ----------
class TestNotes:
    def test_create_list_get_update_delete(self, client, auth_headers):
        # CREATE
        payload = {
            "title": "TEST_Note_" + uuid.uuid4().hex[:6],
            "content": "Hello World Note",
            "tags": ["testing"],
            "pinned": False,
            "priority": "medium",
        }
        r = client.post("/api/notes", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        note = r.json()
        nid = note["id"]
        assert note["title"] == payload["title"]
        assert note["content"] == payload["content"]
        assert note["priority"] == "medium"

        # LIST
        r = client.get("/api/notes", headers=auth_headers)
        assert r.status_code == 200
        notes = r.json()
        assert any(n["id"] == nid for n in notes)

        # GET Single
        r = client.get(f"/api/notes/{nid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == nid

        # UPDATE
        upd = {"title": "TEST_Updated_Title", "content": "Updated Content", "pinned": True, "priority": "high"}
        r = client.patch(f"/api/notes/{nid}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["title"] == "TEST_Updated_Title"
        assert u["content"] == "Updated Content"
        assert u["pinned"] is True
        assert u["priority"] == "high"

        # Verify Persistence
        r = client.get(f"/api/notes/{nid}", headers=auth_headers)
        assert r.json()["title"] == "TEST_Updated_Title"

        # STUDY SET PERSISTENCE
        study_payload = {
            "cards": [{"q": "Test Question?", "a": "Test Answer"}],
            "quiz": [{"q": "Quiz Q?", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "Why"}],
        }
        r = client.post(f"/api/notes/{nid}/study", json=study_payload, headers=auth_headers)
        assert r.status_code == 200
        r_get = client.get(f"/api/notes/{nid}/study", headers=auth_headers)
        assert r_get.status_code == 200
        assert len(r_get.json()["cards"]) == 1

        # DELETE
        r = client.delete(f"/api/notes/{nid}", headers=auth_headers)
        assert r.status_code == 200

        # Verify 404
        r = client.get(f"/api/notes/{nid}", headers=auth_headers)
        assert r.status_code == 404

    def test_reorder(self, client, auth_headers):
        ids = []
        for i in range(3):
            r = client.post("/api/notes", json={"title": f"TEST_Reorder_{i}", "content": str(i)}, headers=auth_headers)
            assert r.status_code == 200
            ids.append(r.json()["id"])

        new_order = list(reversed(ids))
        r = client.post("/api/notes/reorder", json={"note_ids": new_order}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        for idx, nid in enumerate(new_order):
            r = client.get(f"/api/notes/{nid}", headers=auth_headers)
            assert r.status_code == 200
            assert r.json()["order"] == idx

        # Cleanup
        for nid in ids:
            client.delete(f"/api/notes/{nid}", headers=auth_headers)


# ---------- AI Features ----------
class TestAI:
    SAMPLE = (
        "Cellular respiration is a set of metabolic reactions and processes that take place in the cells of "
        "organisms to convert chemical energy from oxygen molecules or nutrients into adenosine triphosphate (ATP)."
    )

    @pytest.mark.parametrize("path", ["continue", "improve", "summarize", "bullets", "keypoints"])
    def test_ai_text_endpoints(self, client, auth_headers, path):
        r = client.post(f"/api/ai/{path}", json={"text": self.SAMPLE}, headers=auth_headers)
        assert r.status_code == 200, f"{path} failed: {r.status_code} {r.text}"
        data = r.json()
        assert "result" in data and isinstance(data["result"], str) and len(data["result"]) > 0

    def test_ai_status(self, client):
        r = client.get("/api/ai/status")
        assert r.status_code == 200
        data = r.json()
        assert "active_provider" in data
        assert "streaming_supported" in data

    def test_ai_counter_and_actions(self, client, auth_headers):
        r_c = client.post("/api/ai/counter", json={"text": self.SAMPLE}, headers=auth_headers)
        assert r_c.status_code == 200
        assert "result" in r_c.json() and len(r_c.json()["result"]) > 10

        r_a = client.post("/api/ai/actions", json={"text": self.SAMPLE}, headers=auth_headers)
        assert r_a.status_code == 200
        assert "result" in r_a.json() and len(r_a.json()["result"]) > 10

    def test_ai_stream(self, client, auth_headers):
        r = client.post("/api/ai/stream", json={"prompt": "Summarize key ideas", "note_context": self.SAMPLE}, headers=auth_headers)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")

    def test_ai_flashcards(self, client, auth_headers):
        r = client.post("/api/ai/flashcards", json={"text": self.SAMPLE}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "cards" in data and isinstance(data["cards"], list)
        assert len(data["cards"]) >= 1
        c0 = data["cards"][0]
        assert "q" in c0 and "a" in c0

    def test_ai_quiz(self, client, auth_headers):
        r = client.post("/api/ai/quiz", json={"text": self.SAMPLE}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "questions" in data and isinstance(data["questions"], list)
        assert len(data["questions"]) >= 1
        q0 = data["questions"][0]
        assert "q" in q0 and "options" in q0 and "answer" in q0

    def test_ai_chat(self, client, auth_headers):
        r = client.post("/api/ai/chat", json={"message": "Hello Ember", "note_context": self.SAMPLE}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data and "session_id" in data
        assert isinstance(data["reply"], str) and len(data["reply"]) > 0

    def test_ai_tutor_general_concept(self, client, auth_headers):
        # 1. Test general concept query with ELI5 depth
        r = client.post(
            "/api/ai/tutor",
            json={"message": "What is recursion?", "level": "eli5", "style": "analogies"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data
        assert "recursion" in data["reply"].lower()
        assert data["level"] == "eli5"
        assert data["style"] == "analogies"

    def test_ai_tutor_note_grounded(self, client, auth_headers):
        # 2. Test note-grounded query
        bio_note = (
            "Title: Cell Biology\n"
            "Mitochondria generate ATP through oxidative phosphorylation.\n"
            "Ribosomes synthesize proteins by translating messenger RNA."
        )
        r = client.post(
            "/api/ai/tutor",
            json={
                "message": "How do mitochondria produce energy?",
                "note_title": "Cell Biology",
                "note_context": bio_note,
                "level": "intermediate",
                "style": "socratic",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data
        assert "mitochondria" in data["reply"].lower() or "atp" in data["reply"].lower()

    def test_ai_search(self, client, auth_headers):
        marker = "uniquekeyword" + uuid.uuid4().hex[:6]
        cn = client.post("/api/notes", json={"title": "TEST_Search_Note", "content": f"Note content with {marker}"}, headers=auth_headers)
        nid = cn.json()["id"]
        try:
            r = client.post("/api/ai/search", json={"query": marker}, headers=auth_headers)
            assert r.status_code == 200
            data = r.json()
            assert "results" in data and isinstance(data["results"], list)
            assert any(res["id"] == nid for res in data["results"])
        finally:
            client.delete(f"/api/notes/{nid}", headers=auth_headers)

    def test_ai_mindmap(self, client, auth_headers):
        r = client.post("/api/ai/mindmap", json={"text": self.SAMPLE, "note_title": "Cellular Biology"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "root" in data and isinstance(data["root"], dict)
        assert "children" in data["root"] and len(data["root"]["children"]) > 0

    def test_mindmap_persistence(self, client, auth_headers):
        cn = client.post("/api/notes", json={"title": "MindMap Test", "content": "Sample content"}, headers=auth_headers)
        nid = cn.json()["id"]
        try:
            mm_data = {"root": {"id": "root", "label": "Test", "children": []}}
            save_r = client.post(f"/api/notes/{nid}/mindmap", json=mm_data, headers=auth_headers)
            assert save_r.status_code == 200

            get_r = client.get(f"/api/notes/{nid}/mindmap", headers=auth_headers)
            assert get_r.status_code == 200
            assert get_r.json()["root"]["label"] == "Test"
        finally:
            client.delete(f"/api/notes/{nid}", headers=auth_headers)

    def test_note_connections_and_graph(self, client, auth_headers):
        # Create two related notes
        n1 = client.post("/api/notes", json={"title": "Quantum Physics", "content": "Exploring entanglement and superposition", "tags": ["physics"]}, headers=auth_headers).json()
        n2 = client.post("/api/notes", json={"title": "Quantum Computing", "content": "Algorithms leveraging Quantum Physics", "tags": ["physics"]}, headers=auth_headers).json()
        try:
            # Check connections for n2
            conn_r = client.get(f"/api/notes/{n2['id']}/connections", headers=auth_headers)
            assert conn_r.status_code == 200
            conns = conn_r.json().get("connections", [])
            assert any(c["id"] == n1["id"] for c in conns)

            # Check workspace graph
            graph_r = client.get("/api/notes/graph", headers=auth_headers)
            assert graph_r.status_code == 200
            g = graph_r.json()
            assert "nodes" in g and "links" in g
            assert any(node["id"] == n1["id"] for node in g["nodes"])
            assert any(node["id"] == n2["id"] for node in g["nodes"])
        finally:
            client.delete(f"/api/notes/{n1['id']}", headers=auth_headers)
            client.delete(f"/api/notes/{n2['id']}", headers=auth_headers)

    def test_spark_thinking_tools(self, client, auth_headers):
        tools = ["assumptions", "perspective", "missing", "research", "expand"]
        for tool in tools:
            r = client.post(f"/api/ai/{tool}", json={"text": self.SAMPLE, "note_title": "Cellular Respiration"}, headers=auth_headers)
            assert r.status_code == 200, f"Tool {tool} failed: {r.status_code} {r.text}"
            data = r.json()
            assert "result" in data and isinstance(data["result"], str)
            assert len(data["result"]) > 20

    def test_spark_tutor(self, client, auth_headers):
        # 1. General concept query (Recursion)
        r_gen = client.post("/api/ai/tutor", json={
            "message": "What is recursion?",
            "level": "eli5",
            "style": "analogies",
            "note_title": "Cellular Respiration",
            "note_context": self.SAMPLE
        }, headers=auth_headers)
        assert r_gen.status_code == 200
        data_gen = r_gen.json()
        assert "reply" in data_gen
        assert "recursion" in data_gen["reply"].lower()
        assert data_gen.get("mode") in ("general", "llm")

        # 2. Note-grounded query
        r_note = client.post("/api/ai/tutor", json={
            "message": "Explain how ATP synthesis works in this note",
            "level": "intermediate",
            "style": "socratic",
            "note_title": "Cellular Respiration",
            "note_context": self.SAMPLE
        }, headers=auth_headers)
        assert r_note.status_code == 200
        data_note = r_note.json()
        assert "reply" in data_note
        assert len(data_note["reply"]) > 20
        assert data_note.get("level") == "intermediate"


# ---------- Real-Time WebSockets ----------
class TestWebSocketCollab:
    def test_websocket_presence_and_cursor(self, client, demo_token):
        note_id = "test-collab-" + uuid.uuid4().hex[:6]

        with client.websocket_connect(f"/api/ws/notes/{note_id}?token={demo_token}") as ws1:
            # Client 1 joins -> receives initial presence broadcast
            msg1 = ws1.receive_json()
            assert msg1["type"] == "presence"
            assert msg1["reader_count"] >= 1
            assert any(c["name"] == "Demo User" for c in msg1["collaborators"])

            # Send cursor movement
            ws1.send_json({"type": "cursor", "x": 120, "y": 240})

            # Send ping heartbeat
            ws1.send_json({"type": "ping"})
            pong = ws1.receive_json()
            assert pong.get("type") == "pong"


# ---------- Collaboration Suite (Comments, Activity, Sharing) ----------
class TestCollaborationSuite:
    def test_comments_and_activity(self, client, auth_headers):
        cn = client.post("/api/notes", json={"title": "Collab Note", "content": "Let's review this together."}, headers=auth_headers)
        nid = cn.json()["id"]
        try:
            # 1. Add comment
            c_res = client.post(f"/api/notes/{nid}/comments", json={"text": "Needs citations in section 2", "anchor_text": "together"}, headers=auth_headers)
            assert c_res.status_code == 200
            cid = c_res.json()["id"]
            assert c_res.json()["text"] == "Needs citations in section 2"

            # 2. List comments
            list_res = client.get(f"/api/notes/{nid}/comments", headers=auth_headers)
            assert list_res.status_code == 200
            comments = list_res.json().get("comments", [])
            assert len(comments) >= 1
            assert any(c["id"] == cid for c in comments)

            # 3. Check activity feed
            act_res = client.get(f"/api/notes/{nid}/activity", headers=auth_headers)
            assert act_res.status_code == 200
            activities = act_res.json().get("activities", [])
            assert len(activities) >= 1
            assert any("comment" in a.get("type", "").lower() or "created" in a.get("type", "").lower() for a in activities)

            # 4. Delete comment
            del_res = client.delete(f"/api/notes/{nid}/comments/{cid}", headers=auth_headers)
            assert del_res.status_code == 200
            assert del_res.json().get("ok") is True

        finally:
            client.delete(f"/api/notes/{nid}", headers=auth_headers)

    def test_sharing_and_collaborators(self, client, auth_headers):
        cn = client.post("/api/notes", json={"title": "Team Note", "content": "Shared team roadmap"}, headers=auth_headers)
        nid = cn.json()["id"]
        try:
            # Share note
            s_res = client.post(f"/api/notes/{nid}/share", json={"email": "teammate@example.com", "role": "editor"}, headers=auth_headers)
            assert s_res.status_code == 200
            assert s_res.json().get("ok") is True

            # Get collaborators
            collab_res = client.get(f"/api/notes/{nid}/collaborators", headers=auth_headers)
            assert collab_res.status_code == 200
            collabs = collab_res.json().get("collaborators", [])
            assert any(c["email"] == "teammate@example.com" for c in collabs)
        finally:
            client.delete(f"/api/notes/{nid}", headers=auth_headers)


# ---------- Spark AI Repair & Functional Collaboration Tests ----------
class TestSparkAIRepairAndCollaboration:
    def test_spark_context_aware_not_context_limited_general_query(self, client, auth_headers):
        """
        Spark must answer general questions accurately even when active note is completely different.
        Current note: 'Photosynthesis'
        Question: 'What is recursion?'
        Spark MUST answer recursion correctly and not be context-limited to photosynthesis.
        """
        payload = {
            "message": "What is recursion?",
            "note_title": "Photosynthesis",
            "note_context": "Chlorophyll pigments absorb solar radiation to synthesize glucose and chemical energy.",
            "mode": "create",
        }
        res = client.post("/api/ai/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        reply = res.json()["reply"]
        assert len(reply) > 50
        assert "recursion" in reply.lower() or "base case" in reply.lower()
        # Ensure it does not spout generic fallback template boilerplate
        assert "A robust architectural framework" not in reply
        assert "multi-variable trade-offs" not in reply

    def test_spark_multi_turn_followup(self, client, auth_headers):
        """
        Spark must handle multi-turn follow-ups maintaining context.
        """
        payload = {
            "message": "Give me an example in python",
            "note_title": "Photosynthesis",
            "note_context": "Chlorophyll pigments absorb solar radiation.",
            "history": [
                {"role": "user", "content": "What is recursion?"},
                {"role": "assistant", "content": "Recursion is a problem-solving technique where a function calls itself."},
            ],
            "mode": "create",
        }
        res = client.post("/api/ai/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        reply = res.json()["reply"]
        assert "def " in reply or "factorial" in reply or "python" in reply.lower()

    def test_spark_note_grounded_challenge_assumptions(self, client, auth_headers):
        """
        Spark must be deeply context-grounded when asked to critique or challenge the note.
        """
        payload = {
            "text": "We assume enterprise customers want fully autonomous AI agents without human verification.",
            "note_title": "Enterprise AI Strategy",
            "mode": "create",
        }
        res = client.post("/api/ai/assumptions", json=payload, headers=auth_headers)
        assert res.status_code == 200
        result = res.json()["result"]
        assert len(result) > 50
        # Must reflect the actual content
        assert any(w in result.lower() for w in ["enterprise", "autonomous", "human", "verification", "risk", "assumption"])

    def test_spark_continue_writing_domain_adaptation(self, client, auth_headers):
        """
        Continue writing must continue the actual note content without generic boilerplate.
        """
        payload = {
            "text": "- [ ] Define database schema migrations\n- [ ] Setup redis cache layer",
            "note_title": "Backend Architecture",
            "mode": "create",
        }
        res = client.post("/api/ai/continue", json=payload, headers=auth_headers)
        assert res.status_code == 200
        result = res.json()["result"]
        assert len(result) > 20
        # Checkbox input should produce checkbox continuations
        assert "- [ ]" in result or "- [x]" in result
        assert "A robust architectural framework" not in result

    def test_spark_facilitator_endpoint(self, client, auth_headers):
        """
        /api/ai/facilitate endpoint must synthesize notes, collaborator comments, and discussions.
        """
        payload = {
            "note_id": "test-note-1",
            "note_title": "Q3 Launch Readiness",
            "note_content": "The application infrastructure is ready for customer onboarding. Target launch date: Oct 15.",
            "comments": [
                {"user_name": "Alice", "text": "Are we certain about database replication latency?", "anchor_text": "infrastructure"},
                {"user_name": "Bob", "text": "Marketing collateral is scheduled for delivery Oct 12.", "anchor_text": "customer onboarding"}
            ],
            "activities": [
                {"type": "comment_added", "description": "Alice commented on infrastructure"}
            ],
            "prompt": "Highlight launch blockers",
        }
        res = client.post("/api/ai/facilitate", json=payload, headers=auth_headers)
        assert res.status_code == 200
        synthesis = res.json()["synthesis"]
        assert "Alice" in synthesis or "replication" in synthesis
        assert "Proposed Team Action Plan" in synthesis or "Consensus" in synthesis or "Alignment" in synthesis

    def test_collaborator_access_and_sharing_workflow(self, client, auth_headers):
        """
        Full collaborator permission workflow:
        1. User A creates note
        2. User A shares with User B (editor)
        3. User B can list, read, edit, and comment on the note
        4. User C (unauthorized) cannot read or edit the note
        """
        # User B signup and login
        email_b = f"collab_{uuid.uuid4().hex[:6]}@example.com"
        r_b = client.post("/api/auth/signup", json={"name": "Collaborator Bob", "email": email_b, "password": "password123!"})
        assert r_b.status_code == 200
        token_b = r_b.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

        # User C signup and login (unauthorized third party)
        email_c = f"stranger_{uuid.uuid4().hex[:6]}@example.com"
        r_c = client.post("/api/auth/signup", json={"name": "Stranger Charlie", "email": email_c, "password": "password123!"})
        assert r_c.status_code == 200
        token_c = r_c.json()["token"]
        headers_c = {"Authorization": f"Bearer {token_c}", "Content-Type": "application/json"}

        # 1. User A creates note
        r_create = client.post("/api/notes", json={"title": "Confidential Project", "content": "Initial draft by User A"}, headers=auth_headers)
        assert r_create.status_code == 200
        note_id = r_create.json()["id"]

        try:
            # 2. User B cannot see note yet
            r_b_get_before = client.get(f"/api/notes/{note_id}", headers=headers_b)
            assert r_b_get_before.status_code == 404

            # 3. User A shares with User B
            r_share = client.post(f"/api/notes/{note_id}/share", json={"email": email_b, "role": "editor"}, headers=auth_headers)
            assert r_share.status_code == 200

            # 4. User B can now list the note
            r_b_list = client.get("/api/notes", headers=headers_b)
            assert r_b_list.status_code == 200
            notes_b = r_b_list.json()
            assert any(n["id"] == note_id for n in notes_b)

            # 5. User B can read the note
            r_b_get = client.get(f"/api/notes/{note_id}", headers=headers_b)
            assert r_b_get.status_code == 200
            assert r_b_get.json()["title"] == "Confidential Project"

            # 6. User B can update the note
            r_b_patch = client.patch(f"/api/notes/{note_id}", json={"content": "Collaborator Bob revised section 1"}, headers=headers_b)
            assert r_b_patch.status_code == 200
            assert r_b_patch.json()["content"] == "Collaborator Bob revised section 1"

            # 7. User B can comment on the note
            r_b_comm = client.post(f"/api/notes/{note_id}/comments", json={"text": "Looks great, let's ship it!"}, headers=headers_b)
            assert r_b_comm.status_code == 200

            # 8. User C (unauthorized) cannot read or update
            r_c_get = client.get(f"/api/notes/{note_id}", headers=headers_c)
            assert r_c_get.status_code == 404

            r_c_patch = client.patch(f"/api/notes/{note_id}", json={"title": "Hacked Title"}, headers=headers_c)
            assert r_c_patch.status_code == 404

        finally:
            # Clean up note
            client.delete(f"/api/notes/{note_id}", headers=auth_headers)


# ---------- Cognitive Engine & Multi-Domain Generalization ----------
class TestCognitiveEngine:
    def test_context_decoupled_general_qa(self, client, auth_headers):
        # When active note is unrelated, general questions MUST NOT be hijacked by the note
        unrelated_note = "hello\n\nits my first time using smart notes lets see what all it can do"
        
        # 1. Biology concept
        r1 = client.post("/api/ai/chat", json={
            "message": "What is photosynthesis?",
            "note_title": "Untitled",
            "note_context": unrelated_note
        }, headers=auth_headers)
        assert r1.status_code == 200
        reply1 = r1.json().get("reply", "").lower()
        assert "photosynthesis" in reply1
        assert "hello" not in reply1
        assert "analyzing **untitled**" not in reply1

        # 2. Statistics / ML concept
        r2 = client.post("/api/ai/chat", json={
            "message": "Explain Bayesian inference",
            "note_title": "Untitled",
            "note_context": unrelated_note
        }, headers=auth_headers)
        assert r2.status_code == 200
        reply2 = r2.json().get("reply", "").lower()
        assert "bayesian" in reply2
        assert "hello" not in reply2

        # 3. Coding task
        r3 = client.post("/api/ai/chat", json={
            "message": "Write a python function to compute moving average",
            "note_title": "Untitled",
            "note_context": unrelated_note
        }, headers=auth_headers)
        assert r3.status_code == 200
        reply3 = r3.json().get("reply", "")
        assert "def " in reply3
        assert "```python" in reply3

    def test_grounded_note_critique_and_continue(self, client, auth_headers):
        biz_note = "We should allocate 100% of the Q4 marketing budget to billboard advertising."
        
        # 1. Challenge assumptions on active note
        r_critique = client.post("/api/ai/chat", json={
            "message": "Challenge my assumptions",
            "note_title": "Marketing Plan",
            "note_context": biz_note
        }, headers=auth_headers)
        assert r_critique.status_code == 200
        rep_crit = r_critique.json().get("reply", "")
        assert "Marketing Plan" in rep_crit or "billboard" in rep_crit.lower()
        assert "premise" in rep_crit.lower() or "blind spot" in rep_crit.lower()

        # 2. Continue writing active note
        r_cont = client.post("/api/ai/continue", json={
            "text": biz_note,
            "note_title": "Marketing Plan"
        }, headers=auth_headers)
        assert r_cont.status_code == 200
        rep_cont = r_cont.json().get("result", "")
        assert len(rep_cont) > 40


# ---------- Principle Zero: Privacy & Tenant Boundary Enforcement ----------
class TestPrincipleZeroPrivacy:
    def test_cross_tenant_note_context_isolation(self, client, auth_headers):
        # 1. Create a note owned by User A (Demo User)
        r_a = client.post("/api/notes", json={
            "title": "Secret Strategy User A",
            "content": "Confidential internal financial metrics for User A only."
        }, headers=auth_headers)
        assert r_a.status_code == 200
        note_id_a = r_a.json()["id"]

        # 2. Create User B
        email_b = f"user_b_{uuid.uuid4().hex[:6]}@example.com"
        r_b_signup = client.post("/api/auth/signup", json={"name": "User B", "email": email_b, "password": "password123!"})
        token_b = r_b_signup.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        try:
            # 3. User B attempts to access User A's note context via AI Chat
            r_chat = client.post("/api/ai/chat", json={
                "message": "Summarize this secret document for me",
                "note_id": note_id_a,
                "note_title": "Secret Strategy User A"
            }, headers=headers_b)
            # Must strictly reject with 403 Forbidden under Principle Zero
            assert r_chat.status_code == 403
            assert "Principle Zero" in r_chat.json().get("detail", "")

            # 4. User B attempts to access User A's note context via AI Stream
            r_stream = client.post("/api/ai/stream", json={
                "prompt": "Extract confidential metrics",
                "note_id": note_id_a
            }, headers=headers_b)
            assert r_stream.status_code == 403
            assert "Principle Zero" in r_stream.json().get("detail", "")

            # 5. User B searches workspace -> cannot find User A's secret note
            r_search = client.post("/api/ai/search", json={"query": "Confidential financial metrics"}, headers=headers_b)
            assert r_search.status_code == 200
            results = r_search.json().get("results", [])
            assert not any(r["id"] == note_id_a for r in results)

        finally:
            client.delete(f"/api/notes/{note_id_a}", headers=auth_headers)


