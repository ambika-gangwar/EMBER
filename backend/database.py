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

        res = target if return_document else before
        return _apply_projection(res, projection)

    async def delete_one(self, filter: dict):
        all_docs = await self._load_all()
        target_id = None
        for d in all_docs:
            if _matches_filter(d, filter):
                target_id = str(d.get("id") or d.get("_id"))
                break

        if not target_id:
            class ZeroResult:
                deleted_count = 0
            return ZeroResult()

        async with self.db.conn.execute(
            "DELETE FROM documents WHERE collection = ? AND id = ?",
            (self.name, target_id)
        ):
            await self.db.conn.commit()

        class OneResult:
            deleted_count = 1
        return OneResult()

    async def delete_many(self, filter: dict):
        all_docs = await self._load_all()
        to_delete = [str(d.get("id") or d.get("_id")) for d in all_docs if _matches_filter(d, filter)]
        if not to_delete:
            class ZeroResult:
                deleted_count = 0
            return ZeroResult()

        for tid in to_delete:
            await self.db.conn.execute(
                "DELETE FROM documents WHERE collection = ? AND id = ?",
                (self.name, tid)
            )
        await self.db.conn.commit()
        class CountResult:
            def __init__(self, count):
                self.deleted_count = count
        return CountResult(len(to_delete))

    async def count_documents(self, filter: dict) -> int:
        all_docs = await self._load_all()
        return sum(1 for d in all_docs if _matches_filter(d, filter))

    async def _load_all(self) -> List[dict]:
        async with self.db.conn.execute(
            "SELECT data FROM documents WHERE collection = ?",
            (self.name,)
        ) as cursor:
            rows = await cursor.fetchall()
            docs = []
            for (r,) in rows:
                try:
                    docs.append(json.loads(r))
                except Exception:
                    pass
            return docs


class SQLiteDeferredCursor(SQLiteCursor):
    def __init__(self, collection: SQLiteCollection, filter_dict: dict, projection: Optional[dict] = None):
        super().__init__([], projection)
        self.collection = collection
        self.filter_dict = filter_dict

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        all_docs = await self.collection._load_all()
        matching = [d for d in all_docs if _matches_filter(d, self.filter_dict)]
        self._docs = matching
        return await super().to_list(length)


class DatabaseAdapter:
    """Manages dual mode connection (MongoDB -> local SQLite)."""
    def __init__(self):
        self.mode: str = "uninitialized"
        self.motor_client = None
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


DEMO_NOTES_DATA = [
    {
        "id": "demo-note-raft",
        "title": "⚡ Distributed Consensus: Raft, Paxos & Split-Brain Dynamics",
        "content": """# Distributed Consensus: Raft, Paxos & Split-Brain Dynamics

In distributed state machines, reaching reliable consensus across unreliable nodes over asynchronous networks is constrained by the **FLP Impossibility Theorem** (Fischer, Lynch, Paterson, 1985): *No asynchronous deterministic consensus protocol can guarantee both safety and liveness in the presence of even a single unannounced fail-stop crash failure.*

## 1. Node State Transitions in Raft
Raft decomposes consensus into discrete subproblems:
- **Follower**: Passive state. Responds to incoming Remote Procedure Calls (RPCs) from Candidates and Leaders.
- **Candidate**: Active election state. Increments current term, votes for self, and broadcasts `RequestVote` RPCs to all peers.
- **Leader**: Authority state. Serves client requests, manages monotonic log replication, and emits periodic heartbeats (`AppendEntries` RPC with empty entries) within heartbeat interval $T_{\\text{heartbeat}}$.

```
[ Follower ] ──(Election timeout elapsed)──> [ Candidate ]
     ▲                                            │
     │                                     (Wins election)
     │                                            │
     └────────(Discovers higher term)───────── [ Leader ]
```

## 2. Quorum Mathematics & Split-Brain Prevention
To prevent dual-leader partitioning (split-brain syndrome), state transitions require strict majority quorum consensus:
$$Q = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1$$
Where $N$ is the total cluster node count. Any two quorums $Q_1, Q_2$ must overlap by at least one node:
$$|Q_1 \\cap Q_2| \\ge 1$$

### Randomized Election Timeouts
To break split-vote deadlocks when multiple nodes transition to candidate state simultaneously, Raft enforces randomized election timeouts:
$$T_{\\text{election}} \\in [150\\text{ms}, 300\\text{ms}]$$
This ensures that one node reliably times out first, increments its term, secures quorum votes, and establishes leadership before peers complete their timer.

## 3. Core Assertions & Critical Assumptions
- **Assumption 1**: Network partitions are temporary; eventual network convergence is guaranteed.
- **Assumption 2**: Nodes fail by stopping (Crash-Fault Tolerant / CFT), not by transmitting corrupted or malicious state transitions (Byzantine Fault Tolerant / BFT).
- **Assumption 3**: Monotonic non-volatile disk writes guarantee log durability across process crashes and sudden power loss.

## 4. Key Takeaways & Trade-offs
- Raft prioritizes **Consistency over Availability** (CP in the CAP Theorem).
- Log compaction via copy-on-write memory snapshots prevents infinite log growth.
- Linearizable read indexes bypass write-ahead logging while guaranteeing non-stale reads.""",
        "tags": ["systems", "consensus", "distributed-computing", "algorithms", "fault-tolerance"],
        "pinned": True,
        "priority": "high",
        "study": {
            "cards": [
                {"q": "What does the FLP Impossibility Theorem state regarding asynchronous consensus?", "a": "No asynchronous deterministic consensus protocol can guarantee both safety and liveness in the presence of even a single unannounced fail-stop crash failure.", "category": "Theoretical Limits"},
                {"q": "What is the quorum formula required to prevent split-brain partition in Raft?", "a": "Q = floor(N/2) + 1. Any two quorums must overlap by at least one node (|Q1 ∩ Q2| >= 1).", "category": "Quorum Mathematics"},
                {"q": "Why does Raft enforce randomized election timeouts (150ms-300ms)?", "a": "Randomized timeouts break split-vote deadlocks by ensuring one candidate times out first, collects majority votes, and becomes leader before competitors.", "category": "Leader Election"},
                {"q": "What are the three distinct states a node can assume in the Raft protocol?", "a": "Follower, Candidate, and Leader.", "category": "State Machine"},
                {"q": "What fundamental fault model does standard Raft assume?", "a": "Crash-Fault Tolerance (CFT) where nodes fail by stopping, rather than Byzantine Fault Tolerance (BFT) where nodes act maliciously.", "category": "Fault Models"},
                {"q": "In terms of the CAP theorem, how does Raft classify?", "a": "Raft is a CP system (prioritizing Consistency and Partition Tolerance over Availability).", "category": "CAP Theorem"}
            ],
            "quiz": [
                {
                    "q": "In a 5-node Raft cluster, what is the minimum quorum size required to elect a leader and commit a log entry?",
                    "options": ["2 nodes", "3 nodes", "4 nodes", "5 nodes"],
                    "answer": 1,
                    "explanation": "Quorum Q = floor(5/2) + 1 = 2 + 1 = 3 nodes."
                },
                {
                    "q": "What happens when a Raft leader discovers a peer transmitting an RPC with a higher term number?",
                    "options": ["The leader immediately demotes to Follower", "The leader increments its own term", "The leader rejects the RPC and continues", "The cluster halts permanently"],
                    "answer": 0,
                    "explanation": "Whenever any node discovers a term strictly greater than its current term, it updates its term and immediately transitions to the Follower state."
                },
                {
                    "q": "Which mechanism prevents infinite write-ahead log expansion on disk in Raft?",
                    "options": ["Linearizable read indexing", "Snapshot log compaction", "Byzantine agreement", "Randomized timeouts"],
                    "answer": 1,
                    "explanation": "Snapshotting periodically writes the complete state machine state to a snapshot file, truncating committed log entries up to that index."
                }
            ]
        }
    },
    {
        "id": "demo-note-crispr",
        "title": "🧬 CRISPR-Cas9, Chromatin Remodeling & Epigenetic Inheritance",
        "content": """# CRISPR-Cas9, Chromatin Remodeling & Epigenetic Inheritance

Clustered Regularly Interspaced Short Palindromic Repeats (CRISPR) combined with the Cas9 endonuclease is an RNA-guided adaptive defense mechanism adapted from *Streptococcus pyogenes* for targeted genomic modification.

## 1. Biochemical Cleavage Mechanism
The CRISPR-Cas9 ribonucleoprotein (RNP) complex operates via a two-component sequence recognition mechanism:

1. **Protospacer Adjacent Motif (PAM) Recognition**:
   The Cas9 protein interrogates double-stranded DNA by first binding to a conserved PAM sequence:
   $$\\text{PAM}_{\\text{SpCas9}} = 5'\\text{-NGG-}3'$$
   Without an adjacent PAM site, guide RNA hybridization and double-strand cleavage cannot occur.

2. **R-Loop Formation & Cleavage**:
   The 20-nucleotide single-guide RNA (sgRNA) unzips the DNA duplex to form an R-loop. The **HNH nuclease domain** cleaves the complementary DNA strand, while the **RuvC nuclease domain** cleaves the non-complementary strand, generating a blunt double-strand break (DSB) 3 base pairs upstream of the PAM.

## 2. Endogenous Cellular DNA Repair Pathways
Following a double-strand break, eukaryotic cells deploy one of two primary repair mechanisms:

- **Non-Homologous End Joining (NHEJ)**:
  - *Mechanism*: Error-prone direct ligation without a repair template.
  - *Outcome*: Random insertions and deletions (indels) leading to translational frameshifts and targeted gene knockout.
  - *Cell Cycle Phase*: Active across all cell cycle phases (G0, G1, S, G2).

- **Homology-Directed Repair (HDR)**:
  - *Mechanism*: High-fidelity recombination using an exogenous donor DNA template.
  - *Outcome*: Precise point mutations, gene insertions, or epitope tagging.
  - *Cell Cycle Phase*: Restricted primarily to late S and G2 phases when sister chromatids serve as homologous templates.

## 3. Epigenetic Landscapes: Chromatin Accessibility
Cas9 binding kinetics depend heavily on nucleosome occupancy and chromatin compaction:
- **Euchromatin**: Open, transcriptionally active chromatin (high histone acetylation H3K27ac) allows rapid Cas9 search times (~30ms).
- **Heterochromatin**: Densely packed chromatin with high DNA methylation (5-methylcytosine at CpG islands) and H3K9me3 marks impedes Cas9 steric access, reducing target cleavage efficiency by up to 80%.

## 4. Fundamental Assumptions to Probe
- **Assumption 1**: sgRNA seed region (bases 1–10 adjacent to PAM) strictly dictates binding specificity, yet off-target cleavages occur at loci with up to 3 mismatches.
- **Assumption 2**: Base editing (e.g., dCas9-deaminase) avoids DSB toxicity, but transcriptome-wide RNA off-target deamination remains an active challenge.""",
        "tags": ["genetics", "crispr", "biology", "biotech", "epigenetics"],
        "pinned": True,
        "priority": "high",
        "study": {
            "cards": [
                {"q": "What is the canonical PAM sequence recognized by Streptococcus pyogenes Cas9 (SpCas9)?", "a": "5'-NGG-3' (where N is any nucleotide).", "category": "Sequence Recognition"},
                {"q": "Which Cas9 nuclease domains cleave the complementary vs non-complementary DNA strands?", "a": "The HNH domain cleaves the complementary target strand, and the RuvC domain cleaves the non-complementary strand.", "category": "Enzymatic Mechanism"},
                {"q": "What is the primary difference between NHEJ and HDR DNA repair pathways?", "a": "NHEJ is error-prone direct ligation causing indels/knockouts (active throughout cell cycle). HDR is high-fidelity template-directed repair (active in late S/G2).", "category": "DNA Repair"},
                {"q": "How does heterochromatin affect Cas9 target interrogation?", "a": "Heterochromatin (compacted DNA with methylation and H3K9me3) creates steric hindrance, reducing Cas9 search kinetics and cleavage efficiency by up to 80%.", "category": "Epigenetics"}
            ],
            "quiz": [
                {
                    "q": "Where does Cas9 introduce the double-strand break relative to the PAM site?",
                    "options": ["Exactly at the PAM site", "3 base pairs upstream of the PAM", "10 base pairs downstream of the PAM", "Randomly within 50 base pairs"],
                    "answer": 1,
                    "explanation": "Cas9 introduces a blunt double-strand break exactly 3 base pairs upstream (5' direction) of the PAM sequence."
                },
                {
                    "q": "Why is Homology-Directed Repair (HDR) primarily restricted to the late S and G2 phases of the eukaryotic cell cycle?",
                    "options": ["Cas9 is degraded in G1 phase", "Homologous sister chromatid repair machinery and resection enzymes are upregulated in S/G2", "PAM sequences are inaccessible in G1", "NHEJ is completely inactive in G1"],
                    "answer": 1,
                    "explanation": "HDR requires 5'-to-3' DNA end resection and homologous recombination factors (such as Rad51) that are naturally active when sister chromatids exist in late S/G2."
                }
            ]
        }
    },
    {
        "id": "demo-note-epistemology",
        "title": "🏛️ Epistemology, Bayesian Rationality & The Architecture of Belief",
        "content": """# Epistemology, Bayesian Rationality & The Architecture of Belief

Epistemology explores the nature, origin, and limits of human knowledge. The classic definition of knowledge as **Justified True Belief (JTB)** states that an agent $S$ knows proposition $P$ if and only if:
1. $P$ is true.
2. $S$ believes $P$.
3. $S$ is justified in believing $P$.

## 1. The Gettier Problem & The Collapse of Classical JTB
In 1963, Edmund Gettier published two counterexamples demonstrating that JTB is insufficient for knowledge.
- *Example*: Smith applies for a job and has strong evidence that Jones will get the job, and that Jones has 10 coins in his pocket. Smith deduces: *"The person who gets the job has 10 coins in their pocket."*
- Unknown to Smith, he gets the job himself, and coincidentally, Smith also has 10 coins in his pocket.
- Smith's belief was **true** and **justified**, but true only by luck. Therefore, justification cannot merely be epistemic luck.

## 2. Bayesian Epistemic Updating
Bayesian epistemology models beliefs not as binary (true/false), but as continuous subjective credences $P(H) \\in [0, 1]$. Upon observing new empirical evidence $E$, belief is updated via Bayes' Theorem:

$$P(H|E) = \\frac{P(E|H) \\cdot P(H)}{P(E)} = \\frac{P(E|H) \\cdot P(H)}{P(E|H)P(H) + P(E|\\neg H)P(\\neg H)}$$

Where:
- $P(H)$: **Prior probability** of the hypothesis before new evidence.
- $P(E|H)$: **Likelihood** of observing evidence $E$ given hypothesis $H$.
- $P(E|\\neg H)$: Likelihood of observing evidence $E$ under alternative explanations.
- $P(H|E)$: **Posterior probability** after conditioning on evidence.

## 3. Popperian Falsification vs. Kuhnian Paradigm Shifts
- **Karl Popper (Falsificationism)**: Scientific theories can never be verified by induction; they can only be falsified. A single reproducible counter-observation refutes universal hypothesis $\\forall x (P(x) \\implies Q(x))$.
- **Thomas Kuhn (Structure of Scientific Revolutions)**: Science progresses through periods of **Normal Science** (puzzle-solving within an accepted paradigm) punctuated by **Paradigm Shifts** when accumulated anomalies force the adoption of an incommensurable new conceptual framework (e.g., Newtonian Mechanics $\\to$ General Relativity).

## 4. Foundational Premises to Challenge
- **Premise 1**: Human reasoners can accurately evaluate objective priors $P(H)$ without unconscious anchoring or ideological bias.
- **Premise 2**: Falsification is clear-cut in practice (the **Duhem-Quine Thesis** demonstrates that hypotheses cannot be tested in isolation—anomalies may simply reflect faulty auxiliary assumptions or instrumentation).""",
        "tags": ["philosophy", "epistemology", "rationality", "cognitive-science", "logic"],
        "pinned": False,
        "priority": "medium",
        "study": {
            "cards": [
                {"q": "What are the three criteria of the classical Justified True Belief (JTB) definition of knowledge?", "a": "1. The proposition is true. 2. The subject believes the proposition. 3. The subject is justified in believing it.", "category": "Epistemic Foundations"},
                {"q": "What fundamental flaw in JTB did Edmund Gettier prove in 1963?", "a": "Gettier showed that a belief can be justified and true purely by coincidence or epistemic luck, which fails to constitute genuine knowledge.", "category": "Gettier Problems"},
                {"q": "In Bayesian epistemology, what does the likelihood ratio P(E|H) / P(E|~H) quantify?", "a": "The Bayes Factor or strength of evidence: how much more likely the observed evidence is under the hypothesis than under competing explanations.", "category": "Bayesian Probability"},
                {"q": "What does the Duhem-Quine thesis assert regarding empirical falsification?", "a": "It is impossible to test a scientific hypothesis in complete isolation, because an experimental test always relies on multiple auxiliary assumptions and background theories.", "category": "Philosophy of Science"}
            ],
            "quiz": [
                {
                    "q": "According to Karl Popper's criterion of demarcation, what distinguishes scientific theories from pseudo-science?",
                    "options": ["Inductive verification", "Falsifiability through empirical observation", "Consensus among peer researchers", "Mathematical elegance"],
                    "answer": 1,
                    "explanation": "Popper argued that a hypothesis is scientific if and only if it is capable of being empirically refuted (falsifiable)."
                }
            ]
        }
    },
    {
        "id": "demo-note-game-theory",
        "title": "🎲 Game Theory: Nash Equilibria, Mechanism Design & Zero-Sum Traps",
        "content": """# Game Theory: Nash Equilibria, Mechanism Design & Zero-Sum Traps

Game theory is the mathematical modeling of strategic interaction among rational decision-makers. A strategic game is formally defined as a tuple $G = (N, (A_i)_{i \\in N}, (u_i)_{i \\in N})$, where $N$ is the set of players, $A_i$ is the strategy action space for player $i$, and $u_i: A \\to \\mathbb{R}$ is the payoff utility function.

## 1. Nash Equilibrium & The Prisoner's Dilemma
A strategy profile $a^* = (a_1^*, \\dots, a_n^*)$ is a **Nash Equilibrium** if no player can strictly improve their expected utility by unilaterally deviating:
$$\\forall i \\in N, \\quad \\forall a_i \\in A_i, \\quad u_i(a_i^*, a_{-i}^*) \\ge u_i(a_i, a_{-i}^*)$$

### Payoff Matrix: Prisoner's Dilemma
| Player 1 \\ Player 2 | Cooperate | Defect |
| :--- | :---: | :---: |
| **Cooperate** | $(3, 3)$ | $(0, 5)$ |
| **Defect** | $(5, 0)$ | $(1, 1)$ |

- **Dominant Strategy**: For both players, *Defect* strictly dominates *Cooperate* regardless of the other player's action.
- **Paradox**: The unique Nash Equilibrium $(1, 1)$ is strictly Pareto-inferior to mutual cooperation $(3, 3)$. Individual rationality leads to collective suboptimal ruin.

## 2. Mechanism Design & Reverse Game Theory
While classic game theory predicts behavior in a given game, **Mechanism Design** asks: *Given a desired social outcome, how do we design the rules and payoff structures such that self-interested agents naturally choose that outcome?*

### The Vickrey-Clarke-Groves (VCG) Auction
In a second-price sealed-bid (Vickrey) auction for a single indivisible item:
- Each bidder submits bid $b_i$.
- The highest bidder wins but pays the second-highest bid $p = \\max_{j \\neq i} b_j$.
- **Dominant Strategy Incentive Compatibility (DSIC)**: Truth-telling ($b_i = v_i$, where $v_i$ is true valuation) is a weakly dominant strategy for every bidder, eliminating strategic bidding overhead.

## 3. Assumptions & Vulnerabilities to Challenge
- **Assumption 1**: Perfect rationality (Common Knowledge of Rationality). In real markets, bounded rationality, loss aversion, and hyperbolic discounting distort theoretical equilibria.
- **Assumption 2**: VCG mechanisms assume no bidder collusion; in practice, second-price auctions are highly vulnerable to bidder rings and seller shill bidding.""",
        "tags": ["economics", "game-theory", "mathematics", "incentives", "systems"],
        "pinned": False,
        "priority": "medium",
        "study": {
            "cards": [
                {"q": "What is the formal definition of a Nash Equilibrium?", "a": "A strategy profile where no individual player can increase their expected payoff by unilaterally deviating from their chosen strategy.", "category": "Equilibria"},
                {"q": "Why is the Prisoner's Dilemma a tragedy of individual rationality?", "a": "Defection is a strictly dominant strategy for both players, leading to the Nash Equilibrium (Defect, Defect) which is strictly worse for both than mutual cooperation.", "category": "Strategic Traps"},
                {"q": "What is Dominant Strategy Incentive Compatibility (DSIC) in Vickrey auctions?", "a": "Bidding your true private valuation (b_i = v_i) is a weakly dominant strategy regardless of what other bidders submit.", "category": "Mechanism Design"}
            ],
            "quiz": [
                {
                    "q": "In a standard Vickrey (second-price sealed-bid) auction, what price does the winning bidder pay?",
                    "options": ["Their own submitted bid", "The second-highest submitted bid", "The average of all bids", "The reserve price plus 10%"],
                    "answer": 1,
                    "explanation": "In a Vickrey auction, the highest bidder wins the item but pays the exact value of the second-highest submitted bid."
                }
            ]
        }
    },
    {
        "id": "demo-note-quantum",
        "title": "🌌 Quantum Entanglement, Superposition & Bell's Theorem",
        "content": """# Quantum Entanglement, Superposition & Bell's Theorem

Quantum mechanics departs from classical determinism through the principles of state superposition, non-commuting observables, and non-local correlations.

## 1. Quantum Superposition & The Qubit State
In contrast to a classical bit ($b \\in \\{0, 1\\}$), a quantum bit (qubit) exists in a normalized linear superposition within a two-dimensional complex Hilbert space $\\mathcal{H}_2$:
$$|\\psi\\rangle = \\alpha |0\\rangle + \\beta |1\\rangle, \\quad \\text{where } \\alpha, \\beta \\in \\mathbb{C} \\quad \\text{and} \\quad |\\alpha|^2 + |\\beta|^2 = 1$$

Upon measurement in the computational basis $\\{|0\\rangle, |1\\rangle\\}$:
- The state collapses to $|0\\rangle$ with probability $P(0) = |\\alpha|^2$.
- The state collapses to $|1\\rangle$ with probability $P(1) = |\\beta|^2$.

## 2. Quantum Entanglement & Maximally Entangled Bell States
Two qubits are entangled when their composite state $|\\Psi\\rangle \\in \\mathcal{H}_A \\otimes \\mathcal{H}_B$ cannot be factored into product states $|\\psi_A\\rangle \\otimes |\\psi_B\\rangle$.
The four orthogonal **Bell States** represent maximal bipartite entanglement:
$$|\\Phi^+\\rangle = \\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}, \\quad |\\Phi^-\\rangle = \\frac{|00\\rangle - |11\\rangle}{\\sqrt{2}}$$
$$|\\Psi^+\\rangle = \\frac{|01\\rangle + |10\\rangle}{\\sqrt{2}}, \\quad |\\Psi^-\\rangle = \\frac{|01\\rangle - |10\\rangle}{\\sqrt{2}}$$

Measuring qubit $A$ instantly determines the measurement outcome of qubit $B$, regardless of spatial separation, without transmitting classical superluminal information (**No-Communication Theorem**).

## 3. Bell's Theorem & The Rejection of Local Hidden Variables
In 1935, Einstein, Podolsky, and Rosen (EPR) argued that quantum mechanics must be incomplete, proposing local hidden variables $\\lambda$.
In 1964, John Stewart Bell proved that any local hidden-variable theory must satisfy **Bell's Inequality (CHSH formulation)**:
$$|E(a, b) - E(a, b') + E(a', b) + E(a', b')| \\le 2$$

Quantum mechanics predicts a maximum violation up to the **Tsirelson Bound**:
$$S_{\\text{quantum}} = 2\\sqrt{2} \\approx 2.828 > 2$$
Decades of loophole-free experiments (Aspect 1982, Hensen 2015) confirm the quantum violation, proving that nature is fundamentally **non-local** or **counterfactually non-definite**.

## 4. Structural Premises to Challenge
- **Wavefunction Collapse**: Is the collapse physical (Penrose objective reduction), informational (Quantum Bayesianism), or an illusion of branching branches (Everett Many-Worlds)?
- **Decoherence**: Environmental entanglement explains the loss of phase coherence, but does not solve the fundamental single-outcome measurement problem.""",
        "tags": ["physics", "quantum", "information-theory", "computation"],
        "pinned": False,
        "priority": "none",
        "study": {
            "cards": [
                {"q": "What is the normalization condition for a pure qubit state |ψ⟩ = α|0⟩ + β|1⟩?", "a": "|α|^2 + |β|^2 = 1, representing the conservation of total measurement probability.", "category": "Quantum States"},
                {"q": "What is the upper bound on Bell-CHSH correlation in local realistic theories vs quantum mechanics?", "a": "Classical local hidden-variable theories are bounded by <= 2. Quantum mechanics violates this up to the Tsirelson bound of 2*sqrt(2) ≈ 2.828.", "category": "Bell's Theorem"},
                {"q": "Why does quantum entanglement not violate Einstein's special relativity (No-Communication Theorem)?", "a": "Local measurement outcomes on an entangled particle appear completely random (50/50) without comparing classical measurement records.", "category": "Information Limits"}
            ],
            "quiz": [
                {
                    "q": "What does Bell's Theorem definitively prove about physical reality?",
                    "options": ["Physical reality is deterministic and classical", "No physical theory of local hidden variables can reproduce all predictions of quantum mechanics", "Faster-than-light signals can transmit binary data across space", "Wavefunctions never undergo decoherence"],
                    "answer": 1,
                    "explanation": "Bell's Theorem proved mathematically that local hidden variable theories are incompatible with quantum mechanical predictions."
                }
            ]
        }
    },
    {
        "id": "demo-note-rome",
        "title": "📜 The Collapse of Complex Systems: Rome, Logistics & Fiscal Crisis",
        "content": """# The Collapse of Complex Systems: Rome, Logistics & Fiscal Crisis

The decline of the Western Roman Empire (culminating in 476 CE with the deposition of Romulus Augustulus) is a quintessential case study in the thermodynamic and institutional limits of expanding complex civilizational systems (Joseph Tainter's *The Collapse of Complex Societies*).

## 1. Diminishing Marginal Returns on Complexity
Societies invest in complexity (standing armies, bureaucratic hierarchies, logistical roads, tax collection mechanisms) to solve existential problems.
- **Early Phase**: Rapid expansion yields high return on investment via captured spoils, bullion, and tribute (e.g., conquest of Macedonia and Egypt).
- **Plateau Phase**: Frontier expansion encounters hostile geographic barriers (Rhine, Danube, Sahara) and low-yield tribal peripheries.
- **Diminishing Returns**: The marginal cost of garrisoning, road maintenance, and imperial administration exceeds the marginal wealth extracted from the periphery.

## 2. Monetary Debasement & Hyperinflation
To fund ballooning military expenditures without political reform, successive Roman emperors systematically reduced the silver content of the standard coin (**Denarius**):

```
Reign of Augustus (27 BCE):      98% Silver
Reign of Nero (64 CE):          90% Silver
Reign of Marcus Aurelius (170): 75% Silver
Reign of Septimius Severus (200): 50% Silver
Reign of Gallienus (260 CE):     <5% Silver (Silver-washed bronze)
```

### Consequences of Currency Collapse
1. **Gresham's Law**: Citizens hoarded pure pre-debasement coinage, driving bad currency into hyper-circulation.
2. **Demonetization**: Merchants refused debased coins; urban trade collapsed into regional barter economies.
3. **Feudalization**: The Edict of Diocletian tied tenant farmers (*coloni*) to their land, accelerating the transition from market urbanization to localized manorial autarky.

## 3. Structural Vulnerabilities to Probe
- **Logistical Fragility**: Hyper-centralized grain shipments from Egypt and North Africa created a single point of failure (SPOF) when Vandal fleets captured Carthage in 439 CE.
- **Institutional Inelasticity**: Roman elites resisted progressive land taxation, forcing the imperial treasury to disproportionately tax impoverished agrarian peasants until productivity collapsed.""",
        "tags": ["history", "geopolitics", "complex-systems", "economics", "institutions"],
        "pinned": False,
        "priority": "none",
        "study": {
            "cards": [
                {"q": "What is Joseph Tainter's core thesis regarding civilizational collapse in complex societies?", "a": "Societies invest in complexity to solve problems until the marginal return on complexity diminishes, eventually becoming economically unsustainable.", "category": "Complex Systems"},
                {"q": "How did silver debasement of the Roman Denarius trigger Gresham's Law?", "a": "Gresham's Law ('bad money drives out good'): Citizens hoarded high-purity silver coinage and spent only debased bronze coins, destroying price stability.", "category": "Monetary Economics"},
                {"q": "What was the logistical Single Point of Failure (SPOF) in the late Western Roman Empire?", "a": "The maritime grain supply route from North Africa to Rome, which collapsed when the Vandals captured Carthage in 439 CE.", "category": "Logistics & Food Security"}
            ],
            "quiz": [
                {
                    "q": "What direct economic consequence occurred when the silver content of the Roman Denarius fell below 5% under Emperor Gallienus?",
                    "options": ["Urban market trade collapsed into localized barter economies", "The Empire adopted a digital ledger", "Agricultural exports quadrupled", "The Roman Senate abolished all taxation"],
                    "answer": 0,
                    "explanation": "Severe currency debasement destroyed public confidence in money, forcing merchants to demand goods in kind and accelerating the shift to feudal barter."
                }
            ]
        }
    }
]


async def seed_demo_data():
    """Ensure standard demo account and rich starter notes exist across diverse domains."""
    demo_email = "demo@smartainotes.com"
    existing = await db.users.find_one({"email": demo_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "name": "Ambika Gangwar",
            "email": demo_email,
            "password_hash": hash_password("demo123!"),
            "created_at": now_iso(),
        })
    else:
        uid = existing["id"]

    # Check existing notes count for demo user
    existing_notes_count = await db.notes.count_documents({"user_id": uid})
    if existing_notes_count < len(DEMO_NOTES_DATA):
        logger.info(f"Seeding rich demo notes for demo user {uid}...")
        # Clear out old notes to ensure clean state
        await db.notes.delete_many({"user_id": uid})
        await db.study_sets.delete_many({"user_id": uid})

        for i, s in enumerate(DEMO_NOTES_DATA):
            note_id = s["id"]
            await db.notes.insert_one({
                "id": note_id,
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

            # Seed pre-generated rich study sets
            study_data = s.get("study")
            if study_data:
                await db.study_sets.insert_one({
                    "id": str(uuid.uuid4()),
                    "note_id": note_id,
                    "user_id": uid,
                    "cards": study_data.get("cards", []),
                    "quiz": study_data.get("quiz", []),
                    "updated_at": now_iso(),
                })

        logger.info(f"Successfully seeded {len(DEMO_NOTES_DATA)} rich cross-disciplinary demo notes.")
