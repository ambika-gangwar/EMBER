# Ember — A spark that helps ideas grow

> **Ember is a spark that helps ideas grow.**  
> A thinking partner and cognitive canvas engineered for deep thinkers, researchers, and learners.

---

## 🌟 Key Features

1. **Ember Intellectual Thinking Partner**:
   - Live streaming co-writer and prose editor.
   - Socratic dialog and high-signal mental models.
   - Slash menu (`/`) commands for assumptions testing, counter-arguments, research questions, and structured synthesis.

2. **Factual & Concrete Study Studio**:
   - **Active-Recall Flashcard Generator**: Automatically distills concrete definitions, sequence mechanisms, and quantitative facts directly from user notes with zero generic filler.
   - **Interactive Practice Quizzes**: 5-question multi-choice quizzes with plausible domain distractors, exact citation explanations, and instant score tracking.
   - **Multi-Depth Ember Tutor**: Adapts dynamically across 4 depths (**ELI5**, **Beginner**, **Intermediate**, **Advanced**) and 4 pedagogical styles (**Socratic**, **Intuitive Analogies**, **Practice Drills**, **Knowledge Checks**). Understands both note context and universal concepts (STEM, CS, humanities).
   - **Executive Takeaways**: High-leverage executive summaries and core realization bullets.

3. **Workspace Knowledge Graph & Concept Visualizer**:
   - Force-directed interactive note connection graph.
   - Automatic hierarchical concept mind maps.

4. **Dual-Mode Persistence & Real-time Collaboration**:
   - Zero-configuration embedded SQLite or high-scale MongoDB.
   - Live WebSocket collaborative editing and cursor presence.

---

## 🚀 Quickstart

### Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn server:app --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Runs on:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
