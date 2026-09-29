# Ember — PRD & Architecture

> *"Ember is a spark that helps ideas grow."*

## Product Overview
Ember is a note-taking and factual study platform. It features an AI writing companion, slash commands, deep active-recall flashcards, concept-grounded quizzes, semantic search, an interactive knowledge graph, mind maps, real-time collaboration, and the adaptive Ember Socratic Tutor.

## Stack
- Backend: FastAPI + SQLite / MongoDB with async motor
- Frontend: React 19 + Tailwind CSS + Radix UI + Framer Motion + Sonner + jsPDF + dnd-kit
- AI Engine: Direct LLM integrations (Google Gemini 2.0 Flash, Claude, OpenAI) + built-in local factual knowledge extraction engine
- Auth: JWT (email/password) — bcrypt hashing
