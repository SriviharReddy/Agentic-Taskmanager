# 🏛️ System Architecture Deep Dive

This document provides a comprehensive technical overview of the **Agentic Task Manager** system design, data models, async pipeline, and communication protocols.

---

## 1. High-Level System Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER (React / Vite)                            │
│                                                                                        │
│   ┌──────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────┐   │
│   │   QuickCapture Module    │  │   Interactive Views      │  │  Copilot Drawer    │   │
│   │ • Text Brain Dumps       │  │ • Kanban Board           │  │ • Real-time SSE    │   │
│   │ • Clipboard Screenshots  │  │ • Eisenhower Matrix      │  │ • Tool Badges      │   │
│   │ • URL Ingestion          │  │ • Filterable List View   │  │ • Telemetry Stream │   │
│   │ • Voice Recording (WebM) │  │ • AI Day Planner Modal   │  │ • Turn History     │   │
│   └─────────────┬────────────┘  └─────────────▲────────────┘  └─────────▲──────────┘   │
└─────────────────┼─────────────────────────────┼─────────────────────────┼──────────────┘
                  │                             │                         │
                  │ POST /api/v1/ingest         │ REST CRUD               │ POST (SSE Stream)
                  │                             │                         │
┌─────────────────▼─────────────────────────────▼─────────────────────────▼──────────────┐
│                               FASTAPI ASYNC APPLICATION ENGINE                         │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                            LANGGRAPH STATE ENGINES                             │   │
│   │                                                                                │   │
│   │   ┌───────────────────────────────────┐    ┌───────────────────────────────┐   │   │
│   │   │         IngestionGraph            │    │       TaskCopilotGraph        │   │   │
│   │   │ • Gemini 3.7 Flash Structured Ext │    │ • Async ReAct Loop            │   │   │
│   │   │ • Fuzzy & Semantic Deduplication  │    │ • ToolNode (CRUD / Breakdown) │   │   │
│   │   │ • Human-in-the-Loop Interrupt()   │    │ • Thread-Scoped Memory Checkp │   │   │
│   │   └─────────────────┬─────────────────┘    └───────────────┬───────────────┘   │   │
│   └─────────────────────┼──────────────────────────────────────┼───────────────────┘   │
│                         │                                      │                       │
│                         ▼                                      ▼                       │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                     ASYNC DATABASE LAYER (SQLAlchemy 2.0)                      │   │
│   │ • Tasks (Title, Priority, Quadrant, Due Date, Est. Minutes, Source Context)    │   │
│   │ • Subtasks (Checklists, Ordering, Completion Flags)                            │   │
│   │ • Tags (Categorical Indexing, Many-to-Many Associations)                       │   │
│   │ • IngestLogs (Audit Trail, Raw Content Hashes, Extracted Counts)               │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Asynchronous Pipeline & Data Ingestion

The ingestion pipeline handles heterogeneous, unstructured input formats and transforms them into strictly validated Pydantic v2 schemas:

1. **Multimodal Normalization**:
   - **Text**: Ingested directly with prompt context.
   - **URLs**: Extracted via `trafilatura` or async `httpx` fallback, stripping HTML boilerplate to isolate actionable content.
   - **Images / Screenshots**: Converted to base64 data URIs and passed directly to Gemini 3.7 Flash's multimodal vision encoder.
   - **Voice Notes**: Recorded in browser via `MediaRecorder` (WebM/Opus) and ingested as audio data.

2. **Temporal & Relative Date Normalization**:
   - Extraction prompts anchor relative phrases (*"tomorrow at 3pm"*, *"by next Friday"*) against the user's localized reference timestamp and IANA timezone.
   - Outputs are normalized to ISO-8601 strings.

3. **Deduplication Engine**:
   - Ingested tasks are matched against active records (`status in ['todo', 'in_progress']`) using string sequence matching and semantic similarity.
   - Matches with similarity $\ge 0.65$ are flagged in the graph state, triggering a LangGraph `interrupt()`.

---

## 3. Database Schema Design (SQLAlchemy Async)

```
┌──────────────────────────┐          ┌──────────────────────────┐
│          tasks           │ 1      * │         subtasks         │
├──────────────────────────┤──────────┼──────────────────────────┤
│ id (PK, Integer)         │          │ id (PK, Integer)         │
│ title (String)           │          │ task_id (FK -> tasks.id) │
│ description (Text)       │          │ title (String)           │
│ status (String)          │          │ is_completed (Boolean)   │
│ priority (Integer 1-4)   │          │ order (Integer)          │
│ eisenhower_quadrant (Str)│          │ created_at (DateTime)    │
│ due_date (DateTime UTC)  │          └──────────────────────────┘
│ estimated_minutes (Int)  │
│ source_type (String)     │          ┌──────────────────────────┐
│ source_context (Text)    │ 1      * │        task_tags         │
│ created_at (DateTime UTC)├──────────┤ (task_id, tag_id)        │
│ updated_at (DateTime UTC)│          └─────────────┬────────────┘
│ completed_at (DateTime)  │                        │ *
└──────────────────────────┘                        │ 1
                                      ┌─────────────▼────────────┐
                                      │           tags           │
                                      ├──────────────────────────┤
                                      │ id (PK, Integer)         │
                                      │ name (String, Unique)    │
                                      └──────────────────────────┘
```

---

## 4. Real-time Streaming Protocol (SSE)

The conversational copilot uses Server-Sent Events (SSE) via FastAPI's `StreamingResponse` wrapping `copilot_graph.astream_events(..., version="v2")`.

### Event Payload Formats

| Event Type | Payload Schema | Purpose |
| :--- | :--- | :--- |
| `init` | `{"type": "init", "thread_id": "chat_abc123"}` | Initializes or affirms conversation thread ID |
| `token` | `{"type": "token", "content": "Sure, I have..."}` | Incremental assistant token stream |
| `tool_start`| `{"type": "tool_start", "name": "create_task", "args": {...}}` | Live notification that agent invoked a tool |
| `tool_end` | `{"type": "tool_end", "name": "create_task", "output": "..."}` | Tool execution output confirmation |
| `done` | `{"type": "done", "thread_id": "chat_abc123"}` | Final completion signal for turn |
| `error` | `{"type": "error", "message": "..."}` | Error surfacing during execution |

---

## 5. Frontend State Management & UX

The frontend is architected around responsive modular components:
- **`Header.tsx`**: View switching (Board / Eisenhower / List), search filtering, Day Planner modal trigger, and Copilot drawer toggle.
- **`QuickCapture.tsx`**: Universal capture supporting keyboard paste (`Ctrl+V`), drag-and-drop file upload, URL scraping, and mic recordings.
- **`TaskBoard.tsx`**: Renders Kanban columns, Eisenhower $2 \times 2$ quadrants, or dense List view.
- **`CopilotDrawer.tsx`**: Manages SSE streaming connections, renders live tool badges with expandable inputs/outputs, and maintains multi-turn conversation state.
- **`InterruptModal.tsx`**: Human-in-the-loop review interface for approving, modifying, or rejecting candidate tasks when LangGraph pauses execution.
