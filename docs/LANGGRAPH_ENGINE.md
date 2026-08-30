# 🤖 LangGraph Engine & StateGraph Topologies

This document details the **LangGraph** implementation within the Agentic Task Manager, including state definitions, node mechanics, human-in-the-loop interrupts, and tool bindings.

---

## 1. StateGraph Overview

The system uses two dedicated LangGraph state machines:

1. **`IngestionGraph`**: A linear-with-branching graph that processes raw multimodal inputs, extracts structured tasks with Gemini 3.7 Flash, runs deduplication checks, and optionally pauses via an `interrupt()` gate before committing to the database.
2. **`TaskCopilotGraph`**: A cyclic ReAct agent graph with tool-calling nodes, conversation history management, and thread persistence.

---

## 2. IngestionGraph (`backend/app/graphs/ingestion_graph.py`)

### Graph Topology Diagram

```
       [START]
          │
          ▼
   ┌──────────────┐
   │ extract_node │  (Gemini 3.7 Flash + Pydantic Structured Output)
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ dedupe_node  │  (Fuzzy & Sequence Matching against Active DB Tasks)
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ approval_node│  ──► Needs review? ──► [interrupt()] ──► UI Review Modal
   └──────┬───────┘                             │
          │                                     │ Resumed with Command(resume=...)
          ├─────────────────────────────────────┘
          │
     ┌────┴────┐
     │         │
[Approved] [Rejected]
     │         │
     ▼         ▼
┌─────────┐ ┌────────┐
│ commit  │ │ cancel │
└────┬────┘ └────┬───┘
     │           │
     ▼           ▼
   [END]       [END]
```

### State Schema (`IngestionState`)

```python
class IngestionState(TypedDict):
    input_text: Optional[str]
    input_url: Optional[str]
    input_image_base64: Optional[str]
    input_audio_base64: Optional[str]
    timezone: str
    
    # Extraction outputs
    raw_content: Optional[str]
    extracted_tasks: List[ExtractedTaskSchema]
    
    # Quality & Deduplication
    duplicates_detected: List[dict]
    needs_human_approval: bool
    
    # Human-in-the-Loop decision
    approval_result: Optional[bool]
    approved_tasks: List[ExtractedTaskSchema]
    
    # Persistence
    committed_task_ids: List[int]
    status: Literal["init", "extracted", "interrupted", "completed", "cancelled"]
    message: str
```

### Node Mechanics

1. **`extract_node`**:
   - Compiles multimodal content (text, URL scrapes via `trafilatura`, base64 image/audio).
   - Ingests user's local reference time and timezone.
   - Invokes `ChatGoogleGenerativeAI(model="gemini-3.7-flash").with_structured_output(ExtractedTaskList)`.

2. **`dedupe_node`**:
   - Queries active tasks (`status in ['todo', 'in_progress']`) from SQLite.
   - Computes string similarity ratios between candidate tasks and existing database tasks using `difflib.SequenceMatcher`.
   - If similarity $\ge 0.65$ or $\ge 3$ tasks are extracted in bulk, sets `needs_human_approval = True`.

3. **`approval_node` (HITL Interrupt)**:
   - When `needs_human_approval` is `True`, triggers `interrupt({...})` with candidate task data and duplicate warnings.
   - Graph execution freezes and writes state to the checkpointer.
   - Resuming via `Command(resume={"approved": True, "tasks": [...]})` routes execution to `commit`, applying any user edits.

4. **`commit_node`**:
   - Writes approved tasks, tags, and checklist subtasks to the database within an async transaction.

---

## 3. TaskCopilotGraph (`backend/app/graphs/copilot_graph.py`)

### Graph Topology Diagram

```
       [START]
          │
          ▼
   ┌──────────────┐
   │  agent_node  │ ◄──────────┐
   │ (Chat Model) │            │
   └──────┬───────┘            │
          │                    │
          ▼                    │
    [should_continue]          │
          │                    │
    Tool calls?                │
    ├── Yes ──► ┌─────────────┐│
    │           │ execute_tool│┘
    │           │ (ToolNode)  │
    │           └─────────────┘
    └── No  ──► [END]
```

### State Schema (`CopilotState`)

```python
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class CopilotState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    timezone: str
    active_filters: Optional[dict]
```

### Bound Tools

| Tool Name | Parameters | Purpose |
| :--- | :--- | :--- |
| `create_task` | `title`, `description`, `priority`, `due_date_iso`, `estimated_minutes`, `tags`, `subtasks` | Creates a structured task in SQLite |
| `list_tasks` | `status`, `priority`, `search_query` | Queries tasks with multi-field filtering |
| `complete_task`| `task_id` | Marks task as done with completion timestamp |
| `update_task` | `task_id`, `title`, `status`, `priority`, `due_date_iso`, `estimated_minutes` | Updates properties of an existing task |
| `delete_task` | `task_id` | Deletes a task and its subtasks |
| `breakdown_task`| `task_id`, `steps` | Adds checklist subtasks to a complex task |

---

## 4. Visual Debugging with LangGraph Studio

This repository includes a `langgraph.json` specification:

```json
{
  "$schema": "https://langgra.ph/schema.json",
  "dependencies": ["."],
  "graphs": {
    "ingestion": "./backend/app/graphs/ingestion_graph.py:ingestion_graph",
    "copilot": "./backend/app/graphs/copilot_graph.py:copilot_graph"
  },
  "env": ".env"
}
```

To run LangGraph Studio locally:
```bash
pip install -U "langgraph-cli[inmem]"
langgraph dev
```
Studio will launch at `http://localhost:2024`, allowing you to inspect execution steps, test interrupts, and replay graph states interactively.
