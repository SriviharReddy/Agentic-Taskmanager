# ⚡ Agentic Task Manager

> **Turn chaotic thoughts, screenshots, links, and voice notes into an organized, prioritized todo list.**  
> Built with **LangGraph**, **Google Gemini 3.7 Flash**, **FastAPI**, and **React**.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/Orchestrator-LangGraph-orange?logo=langchain)](https://www.langchain.com/langgraph)
[![Gemini 3.7 Flash](https://img.shields.io/badge/AI%20Model-Gemini%203.7%20Flash-green?logo=google)](https://ai.google.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React + Tailwind](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61DAFB?logo=react)](https://react.dev/)
[![Tests Passing](https://img.shields.io/badge/Tests-9%2F9%20Passing-brightgreen)](https://github.com/SriviharReddy/Agentic-Taskmanager)

---

## 📸 The Application in Action

![Agentic Task Manager UI](docs/assets/screenshot.png)

---

## 💡 What is Agentic Task Manager?

Traditional todo lists require you to manually type, format, tag, and schedule every single task. 

**Agentic Task Manager** is an AI-powered personal task manager that handles the heavy lifting for you:

- 🧠 **Dump Your Thoughts**: Paste messy meeting notes, brain dumps, or chaotic emails.
- 📸 **Paste Screenshots (`Ctrl+V`)**: Upload or paste screenshots of Slack messages, Jira tickets, or whiteboards.
- 🔗 **Drop Links**: Ingest articles, documentation pages, or GitHub issues.
- 🎙️ **Record Voice Memos**: Speak your todos on the go with built-in voice recording.
- 🤖 **Interactive AI Copilot**: Chat with a real-time AI assistant that can create, prioritize, search, break down, and complete tasks for you.
- 📅 **AI Day Planner**: Tell the app how many hours you have free today, and it will generate an optimal timeboxed hourly schedule.

---

## 🌟 Key Highlights

### 1. Multimodal Quick Capture
Instead of manual data entry, drop any text, screenshot, URL, or voice recording into the **Quick Capture bar**. The AI extracts actionable items, assigns realistic time estimates, resolves relative dates (e.g., *"tomorrow at 2pm"* $\to$ exact timestamp), and tags them automatically.

### 2. Smart Deduplication & Human-in-the-Loop
When you extract tasks, the system checks them against your existing database. If it finds similar tasks or extracts a large batch, it pauses and shows you a **review modal** so you can tweak, merge, or approve tasks before they are saved.

### 3. Multiple Ways to Organize
- **Kanban Board**: Drag and track tasks across *To Do*, *In Progress*, and *Completed*.
- **Eisenhower Matrix**: Automatically groups tasks into 4 quadrants (*Do First*, *Schedule*, *Delegate*, *Eliminate*) so you always know what matters most.
- **Filterable List**: Dense, fast table with instant search and tag filters.

### 4. One-Click AI Task Breakdown
Stuck on a daunting task? Click the **AI Breakdown** button to automatically decompose it into 3–5 concrete checklist subtasks.

---

## 📚 Technical Documentation & Deep Dives

For engineering details, architecture diagrams, and API specifications, explore the **`docs/`** directory:

- 🏛️ **[System Architecture (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)**  
  *End-to-end system topology, async pipeline, database schemas, and Server-Sent Events (SSE) streaming.*

- 🤖 **[LangGraph Engine & StateGraphs (`docs/LANGGRAPH_ENGINE.md`)](docs/LANGGRAPH_ENGINE.md)**  
  *Detailed breakdown of the `IngestionGraph` (multimodal extraction $\to$ deduplication $\to$ `interrupt()` approval gate $\to$ commit) and `TaskCopilotGraph` (ReAct conversational loop with tools).*

- 📖 **[API Reference (`docs/API_REFERENCE.md`)](docs/API_REFERENCE.md)**  
  *Complete REST endpoint documentation, SSE event payloads, and Pydantic request/response schemas.*

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Google Gemini API Key** (Free from [Google AI Studio](https://aistudio.google.com/))

### 1. Clone & Configure
```bash
git clone https://github.com/SriviharReddy/Agentic-Taskmanager.git
cd Agentic-Taskmanager

# Create your .env file
echo GOOGLE_API_KEY="your-gemini-api-key" > .env
```

### 2. Start Backend
```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```
*API documentation available at `http://localhost:8000/docs`.*

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## 🐳 One-Command Docker Setup

You can run the complete fullstack application with Docker Compose:

```bash
docker-compose up --build
```
*Access the web app at `http://localhost:8000`.*

---

## 🔍 Visual Debugging with LangGraph Studio

To visually step through the state graph, inspect checkpoints, and test human-in-the-loop interrupts:

```bash
pip install -U "langgraph-cli[inmem]"
langgraph dev
```

---

## 🧪 Testing & Evaluation

Run the automated test suite and evaluation benchmarks:

```bash
pytest
```
*All 9 unit tests and evaluation benchmarks validate schema correctness, fuzzy deduplication, and API lifecycle endpoints.*

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
