 
# Ember — A Calm Thinking Environment

<div align="center">

```
  ███████╗███╗   ███╗██████╗ ███████╗██████╗ 
  ██╔════╝████╗ ████║██╔══██╗██╔════╝██╔══██╗
  █████╗  ██╔████╔██║██████╔╝█████╗  ██████╔╝
  ██╔══╝  ██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗
  ███████╗██║ ╚═╝ ██║██████╔╝███████╗██║  ██║
  ╚══════╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝
```

**A notebook crafted for deep thinkers, researchers, and learners.**  
*Write without friction · Retain through active recall · Explore ideas visually*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Principle Zero](https://img.shields.io/badge/Security-Principle_Zero_Compliant-8B5CF6.svg?style=flat-square)](https://github.com)
[![Test Suite](https://img.shields.io/badge/Tests-39%2F39_Passing-10B981.svg?style=flat-square)](https://github.com)

</div>

---

## 📖 Table of Contents

- [Vision & Product Philosophy](#-vision--product-philosophy)
- [Key Features](#-key-features)
  - [1. Effortless Writing Canvas](#1-effortless-writing-canvas)
  - [2. Factual Active-Recall Studio](#2-factual-active-recall-studio)
  - [3. Visual Mind Maps & Knowledge Graph](#3-visual-mind-maps--knowledge-graph)
  - [4. Socratic Cognitive Companion (Spark)](#4-socratic-cognitive-companion-spark)
  - [5. Frictionless Live Collaboration](#5-frictionless-live-collaboration)
- [Principle Zero: Privacy & Tenant Isolation](#-principle-zero-privacy--tenant-isolation)
- [Technical Architecture](#-technical-architecture)
- [API Reference](#-api-reference)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Getting Started](#-getting-started)
- [Running Tests](#-running-tests)

---

## 🌿 Vision & Product Philosophy

Ember was designed as if **Apple Notes, Bear Notes, Arc Browser, and Linear** collaborated to create the ultimate thinking environment.

### Core Principles

1. **The Note is the Hero**: Users spend 95% of their attention on content. Not menus, not toolbars, not promotional AI buttons. The interface quietly gets out of the way.
2. **Warm Tactile Materials**: Warm paper whites (`#FAF8F4`), soft charcoal typography, hairline 1px borders, and quiet ambient depth replace neon gradients and distracting glassmorphism.
3. **Color as Punctuation**: 90% neutral, 10% gentle Ember violet/amber used exclusively for active states and subtle glyphs.
4. **Intelligence on Demand**: AI never shouts. It appears as magic when summoned (`/` slash commands, highlighting text, or `⌘J` slide-over) and disappears when writing.

---

## ✨ Key Features

### 1. Effortless Writing Canvas
- **Centered Writing Column**: Spacious 700px reading width with high-readability typography (`line-height: 1.85`).
- **Slash Commands (`/`)**: Type `/` to invoke instant formatting, outline generation, summary bullets, or research probes.
- **Selection Toolbar**: Highlight any text to polish prose, challenge unspoken assumptions, or explore alternative paradigms.
- **Split & Live Preview**: Real-time Markdown rendering with task list toggles and code block highlighting.
- **Publication-Ready PDF Export**: Export study guides and formatted notes with a single click.

### 2. Factual Active-Recall Studio
- **3D Tactile Flashcards**: Automatically extracts key concepts, mechanisms, and formulas into flip cards.
- **4-Tier Spaced Repetition**: Grade recall with `[1] Again`, `[2] Hard`, `[3] Good`, and `[4] Easy` (keyboard shortcut enabled).
- **Interactive Concept Quizzes**: Multiple-choice quizzes with plausible distractors, immediate scoring, and explanatory rationale.
- **Executive Takeaways**: Instant distillation into executive summaries and core realization bullets.

### 3. Visual Mind Maps & Knowledge Graph
- **Hierarchical Concept Mind Maps**: Automatically organizes complex topics into clean, expandable visual trees.
- **Bidirectional Note Linking**: Connect thoughts across documents with live link previews.
- **Global Workspace Knowledge Graph**: Force-directed 2D graph visualizing connections across your entire notebook.

### 4. Socratic Cognitive Companion (Spark)
- **4 Pedagogical Depths**: Adapt explanations dynamically from **ELI5**, **Beginner**, **Intermediate**, to **Advanced**.
- **4 Inquiry Styles**: Toggle between **Socratic Dialogue**, **Intuitive Analogies**, **Practice Drills**, and **Knowledge Checks**.
- **Universal Reasoning**: Seamlessly assists with domain-specific notes as well as arbitrary unseen concepts (algorithms, molecular biology, Roman history, economics).
- **Multi-Model Engine**: Switch freely between Gemini 2.0, Claude 3.5, GPT-4o, or local engines.

### 5. Frictionless Live Collaboration
- **Real-Time Cursor Tracking**: See collaborator mouse positions and text selections live.
- **Multi-User Sync**: Conflict-free WebSocket broadcasting for concurrent document editing.
- **Presence Avatars**: Subtle titlebar indicators showing active readers and editors.

---

## 🛡️ Principle Zero: Privacy & Tenant Isolation

User data belongs strictly to the user. Ember is architected with non-negotiable data boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRINCIPLE ZERO RULES                     │
├─────────────────────────────────────────────────────────────┤
│ 1. AI only accesses explicitly authorized active note data. │
│ 2. Retrieval queries are strictly scoped by User ID.        │
│ 3. Memory & context never cross tenant boundaries.          │
│ 4. System prompts and hidden instructions are sealed.       │
│ 5. When in doubt, prioritize privacy over helpfulness.      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Technical Architecture

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (React 19 + Tailwind CSS)"]
        UI[Workspace Canvas & Editor]
        Study[Active-Recall Studio]
        Graph[Mind Map & Graph Visualizer]
        WS_Client[WebSocket Collab Client]
    end

    subgraph Backend ["Backend (FastAPI + Python 3.14)"]
        Router[API Router & Auth Middleware]
        Cognitive[Spark Reasoning Pipeline]
        Collab_Hub[WebSocket Presence Hub]
        DB_Adapter[Persistence Layer]
    end

    subgraph Storage ["Storage & AI Engines"]
        SQLite[(SQLite / MongoDB)]
        AI_Engines[Gemini / Claude / GPT / Local]
    end

    UI -->|REST API| Router
    Study -->|REST API| Router
    Graph -->|REST API| Router
    WS_Client <-->|Live Stream| Collab_Hub

    Router --> Cognitive
    Router --> DB_Adapter
    Cognitive --> AI_Engines
    DB_Adapter --> SQLite
```

---

## 📡 API Reference

### Authentication & Workspace
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/signup` | Register a new user account |
| `POST` | `/auth/login` | Authenticate and retrieve JWT token |
| `GET` | `/auth/me` | Retrieve current authenticated user profile |

### Notes Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/notes` | List all notes owned by current user |
| `POST` | `/notes` | Create a new document |
| `GET` | `/notes/{id}` | Fetch document by ID |
| `PATCH` | `/notes/{id}` | Update title, content, priority, or pin status |
| `DELETE` | `/notes/{id}` | Delete a note |
| `POST` | `/notes/reorder` | Update custom drag-and-drop order |

### Active-Recall & Cognitive Services
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/ai/flashcards` | Generate active-recall flashcard deck |
| `POST` | `/ai/quiz` | Generate self-grading practice quiz |
| `POST` | `/ai/tutor` | Query Socratic tutor with depth & style parameters |
| `POST` | `/ai/summarize` | Generate executive summary |
| `POST` | `/ai/keypoints` | Distill key takeaway bullets |
| `POST` | `/ai/mindmap` | Generate hierarchical concept mind map |
| `POST` | `/ai/general` | Arbitrary concept explanation & reasoning |
| `POST` | `/insights/daily` | Fetch contemplative daily reflection prompt |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `⌘K` / `Ctrl+K` | Open Universal Search | Global |
| `⌘J` / `Ctrl+J` | Toggle Spark AI Companion | Global |
| `⌘N` / `Ctrl+N` | Create New Note | Global |
| `⌘1` / `Ctrl+1` | Switch to Write Mode | Editor |
| `⌘2` / `Ctrl+2` | Switch to Study Studio | Editor |
| `⌘3` / `Ctrl+3` | Switch to Collaborate Mode | Editor |
| `/` | Open Slash Formatting Menu | Editor Textarea |
| `Space` | Flip Flashcard Front/Back | Study Studio |
| `1`, `2`, `3`, `4` | Grade Flashcard Recall | Study Studio |
| `←` / `→` | Navigate Flashcard Deck | Study Studio |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (tested on 3.10, 3.11, 3.12, 3.14)
- **Node.js 18+** and **npm**

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Start the development server
npm start
```

Open your browser at **`http://localhost:3000`**.  
Interactive API documentation is live at **`http://127.0.0.1:8000/docs`**.

---

## 🧪 Running Tests

Ember features a comprehensive automated test suite verifying auth, CRUD operations, active recall generation, search, and Principle Zero multi-tenant isolation.

```bash
# Run pytest in backend directory
cd backend
python -m pytest tests/backend_test.py -v
```

Expected output:
 
 #  Ember

<p align="center">
  <h3 align="center">A beautiful home for your thoughts.</h3>
  <p align="center">
    Learn. Think. Connect.
  </p>
</p>

---

## Overview

Ember is an AI-native workspace designed for thinking, learning, writing, and collaboration.

Most note-taking applications help people store information.

Ember helps people understand it.

By combining intelligent note-taking, active-recall learning systems, contextual AI assistance, knowledge mapping, and real-time collaboration, Ember transforms notes into a living cognitive workspace.

Whether you're studying for exams, planning projects, conducting research, writing ideas, or working with a team, Ember adapts to the way you think.

---

## Why Ember?

Modern productivity tools often force users to jump between multiple applications:

- Notes live in one place
- Flashcards live in another
- Collaboration happens elsewhere
- AI exists as a separate tool

Ember unifies everything into a single experience.

The result is a workspace where thinking, learning, remembering, and collaborating happen naturally.

---

## Core Philosophy

### Notes First

The note is the center of the experience.

Not the AI.
Not the dashboard.
Not the settings.

Everything begins with a thought.

---

### Intelligence When Needed

Spark, Ember's built-in AI companion, is designed to feel native rather than bolted on.

Instead of constantly demanding attention, Spark appears exactly when it's useful.

Examples:

- Improve selected writing
- Explain a difficult concept
- Generate flashcards
- Build quizzes
- Challenge assumptions
- Continue unfinished ideas

The best AI experience is often invisible.

---

### Learning Through Understanding

Information is easy to collect.

Understanding is harder.

Ember transforms notes into:

- Flashcards
- Practice quizzes
- Socratic tutoring sessions
- Mind maps
- Knowledge reviews

Helping users move beyond memorization toward mastery.

---

### Privacy Over Convenience

Ember follows a simple principle:

> User data belongs to the user.

All AI interactions operate within strict authorization boundaries.

Privacy is a foundational product principle, not an afterthought.

---

# ✍️ Create Mode

Create Mode is designed for deep focus and frictionless thinking.

Features include:

- Rich Markdown editor
- Live writing statistics
- Slash command actions
- AI-assisted writing
- Knowledge extraction
- Auto-save
- Context-aware suggestions

### Inline Actions

```text
/improve
/summarize
/expand
/counter
/actions
/bullets
/keypoints
```

Highlight text and transform ideas without leaving the editor.

---

# 🎓 Study Mode

Turn passive notes into active learning tools.

### Flashcards

Generate recall-focused flashcards directly from note content.

### Practice Quizzes

Create multiple-choice assessments with explanations.

### Socratic Tutor

Choose your preferred level:

- ELI5
- Beginner
- Intermediate
- Advanced

And learning style:

- Socratic Dialogue
- Analogies
- Practice Questions
- Knowledge Checks
- Standard Teaching

### Concept Mind Maps

Visualize knowledge structures through interactive concept trees and connected ideas.

---

# 🤝 Collaborate Mode

Create, learn, and work together in real time.

### Live Collaboration

- Shared notes
- Presence indicators
- Real-time editing
- Cursor awareness

### Contextual Comments

Attach discussions directly to relevant sections of content.

### Activity Timeline

Track:

- Edits
- Comments
- Shares
- Collaborator activity

### Spark Facilitator

Automatically synthesizes conversations, debate threads, and feedback into clear decisions and action items.

---

# 🧠 Spark AI

Spark is Ember's built-in cognitive partner.

Unlike traditional chat assistants, Spark understands intent, context, and workflow.

### Capabilities

- Research Expansion
- Writing Assistance
- Concept Explanation
- Critical Thinking
- Counterarguments
- Assumption Analysis
- Summarization
- Active Recall Generation
- Knowledge Gap Detection
- Learning Support

Spark isn't designed to replace thinking.

It's designed to improve it.

---

# 🕸️ Knowledge Graph

Knowledge becomes more valuable when ideas connect.

Ember automatically identifies relationships between notes through:

- Shared concepts
- Common tags
- Referenced ideas
- Semantic similarity
- Topic overlap

Helping users uncover connections they may not have seen themselves.

---

# 🔒 Security & Privacy

## Principle Zero

> User data belongs exclusively to the user.

Spark may only access:

- The active request
- Authorized note context
- Workspace-scoped retrieval results

Spark may never:

- Access another user's data
- Cross tenant boundaries
- Reveal hidden prompts
- Expose private memories
- Leak workspace information

When uncertainty exists, Ember prioritizes privacy over helpfulness.

### Security Features

- JWT Authentication
- Role-Based Permissions
- Password Hashing
- Tenant Isolation
- Ownership Validation
- Authorization Enforcement
- Audit Logging
- Prompt Injection Protection
- Context Isolation

---

# 🏗 Architecture

## Backend

```text
Python
FastAPI
Pydantic
Uvicorn
JWT Authentication
WebSockets
Server-Sent Events
```

## Frontend

```text
React
React Router
Tailwind CSS
Framer Motion
Lucide Icons
```

## Database

```text
SQLite
MongoDB
PostgreSQL (planned)
```

## AI Providers

```text
Google Gemini
Anthropic Claude
OpenAI GPT Models
Local Models
>>>>>>> 1e4a0d6e276bce1beada712cc8a434c17a3a1048
```

---

<<<<<<< HEAD
<div align="center">
  <sub>Crafted with quiet confidence · Ember © 2026</sub>
</div>
=======
# ⚡ System Flow

```text
User Request
      │
      ▼
Intent Classification
      │
      ▼
Context Relevance Analysis
      │
      ▼
Knowledge Retrieval
      │
      ▼
Specialized Reasoning
      │
      ▼
Response Generation
      │
      ▼
Actionable Output
```

---

# 📂 Project Structure

```text
frontend/
│
├── components/
├── pages/
├── context/
├── hooks/
└── services/

backend/
│
├── server.py
├── ai_service.py
├── auth.py
├── database.py
└── tests/

shared/
└── models/
```

---

# 🌅 Vision

We believe knowledge tools should do more than store information.

They should help people:

- Think clearly
- Learn deeply
- Remember effectively
- Create confidently
- Collaborate effortlessly

Ember exists to become a personal cognitive operating system for learners, builders, researchers, and curious minds.

---

#   Design Philosophy

Technology should feel human.

The best software disappears.

The best tools create space for thought.

Ember is designed to feel calm, warm, focused, and intentional.

A place where ideas can grow.

A place where learning feels natural.

A place where your thoughts belong.

---

<p align="center">
  Built with ❤️ for thinkers, learners, builders, and dreamers.
</p>

<p align="center">
   Ember — A beautiful home for your thoughts.
</p>
