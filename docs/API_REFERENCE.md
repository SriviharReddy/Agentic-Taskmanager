# 📖 API Reference & Endpoint Specifications

Base URL: `http://localhost:8000/api/v1`  
Interactive OpenAPI / Swagger Docs: `http://localhost:8000/docs`

---

## 1. Tasks Endpoints (`/api/v1/tasks`)

### `GET /api/v1/tasks`
Retrieve a list of tasks with multi-field filtering.

**Query Parameters:**
- `status` (string, optional): `todo`, `in_progress`, `done`, `archived`
- `priority` (integer, optional): `1`, `2`, `3`, `4`
- `eisenhower_quadrant` (string, optional): `do_first`, `schedule`, `delegate`, `eliminate`
- `tag` (string, optional): Filter by tag name
- `search` (string, optional): Text search on title and description

**Response (`200 OK`):**
```json
{
  "total": 1,
  "tasks": [
    {
      "id": 1,
      "title": "Prepare Q3 Financial Review presentation",
      "description": "Consolidate revenue charts and runway projections",
      "status": "todo",
      "priority": 1,
      "eisenhower_quadrant": "do_first",
      "due_date": "2026-09-02T14:00:00Z",
      "estimated_minutes": 90,
      "source_type": "manual",
      "source_context": null,
      "created_at": "2026-08-30T10:00:00Z",
      "updated_at": "2026-08-30T10:00:00Z",
      "completed_at": null,
      "subtasks": [
        { "id": 1, "task_id": 1, "title": "Export Stripe analytics", "is_completed": false, "order": 0, "created_at": "2026-08-30T10:00:00Z" }
      ],
      "tags": [
        { "id": 1, "name": "finance" }
      ]
    }
  ]
}
```

---

### `POST /api/v1/tasks`
Create a new task with nested tags and checklist subtasks.

**Request Body:**
```json
{
  "title": "Launch beta signup page",
  "description": "Deploy Next.js landing page with Supabase auth",
  "priority": 2,
  "eisenhower_quadrant": "schedule",
  "due_date": "2026-09-05T18:00:00Z",
  "estimated_minutes": 45,
  "tags": ["launch", "web"],
  "subtasks": ["Configure DNS", "Test Stripe webhook"]
}
```

---

### `PATCH /api/v1/tasks/{id}`
Update task properties (status, priority, deadline, description).

**Request Body:**
```json
{
  "status": "done",
  "priority": 1
}
```

---

### `POST /api/v1/tasks/{id}/breakdown`
Decompose a high-level task into concrete checklist subtasks using Gemini 3.7 Flash.

**Query Parameters:**
- `num_steps` (integer, default: 4): Number of subtasks to generate ($2 - 8$)

---

## 2. Ingestion & HITL Endpoints (`/api/v1/ingest`)

### `POST /api/v1/ingest`
Ingests unstructured multimodal content (text, URL, screenshot base64, audio base64) and runs `IngestionGraph`.

**Request Body:**
```json
{
  "text": "Call accountant tomorrow at 3pm to file tax return and email Sarah the receipt",
  "url": null,
  "image_base64": null,
  "audio_base64": null,
  "timezone": "America/New_York"
}
```

**Response (`200 OK` - Completed):**
```json
{
  "thread_id": "ingest_a1b2c3d4",
  "status": "completed",
  "tasks_extracted": [
    {
      "title": "Call accountant to file tax return",
      "description": "Resolve tax return filing",
      "priority": 1,
      "eisenhower_quadrant": "do_first",
      "due_date_iso": "2026-08-31T15:00:00-04:00",
      "estimated_minutes": 30,
      "tags": ["finance", "tax"],
      "subtasks": [],
      "source_context": "Call accountant tomorrow at 3pm to file tax return"
    }
  ],
  "duplicates_detected": [],
  "message": "Successfully created 2 new tasks."
}
```

**Response (`200 OK` - Interrupted for Review):**
```json
{
  "thread_id": "ingest_e5f6g7h8",
  "status": "interrupted_review_needed",
  "tasks_extracted": [...],
  "duplicates_detected": [
    {
      "extracted_title": "File tax return",
      "existing_id": 4,
      "existing_title": "Submit 2025 tax paperwork",
      "existing_status": "todo",
      "similarity_score": 0.82
    }
  ],
  "message": "Extracted candidate tasks need user review before saving."
}
```

---

### `POST /api/v1/ingest/resume`
Resumes an interrupted `IngestionGraph` after human approval or task editing.

**Request Body:**
```json
{
  "thread_id": "ingest_e5f6g7h8",
  "approved": true,
  "tasks": [...]
}
```

---

## 3. Streaming Chat Endpoint (`/api/v1/chat/stream`)

### `POST /api/v1/chat/stream`
Conversational Task Copilot streaming endpoint over Server-Sent Events (SSE).

**Request Body:**
```json
{
  "message": "What are my top priority tasks due this week?",
  "thread_id": "chat_session_1",
  "timezone": "UTC"
}
```

**SSE Stream Output:**
```
data: {"type": "init", "thread_id": "chat_session_1"}

data: {"type": "tool_start", "name": "list_tasks", "args": {"priority": 1, "status": "todo"}}

data: {"type": "tool_end", "name": "list_tasks", "output": "- #46 [TODO] (P1) Prepare Q3 Financial Review"}

data: {"type": "token", "content": "Here "}
data: {"type": "token", "content": "is your top priority task: **Prepare Q3 Financial Review**."}

data: {"type": "done", "thread_id": "chat_session_1"}
```

---

## 4. AI Day Planner Endpoint (`/api/v1/planner`)

### `POST /api/v1/planner/day-schedule`
Generates an optimized, timeboxed daily schedule based on pending tasks.

**Request Body:**
```json
{
  "available_hours": 4.0,
  "focus_mode": "balanced",
  "current_time_iso": "2026-08-30T09:00:00Z"
}
```

**Response (`200 OK`):**
```json
{
  "summary": "Front-loaded Priority 1 financial review during peak morning energy, followed by scheduled break and quick admin tasks.",
  "total_planned_minutes": 195,
  "unplanned_tasks_count": 2,
  "schedule": [
    {
      "task_id": 46,
      "title": "Prepare Q3 Financial Review presentation",
      "start_time": "09:00",
      "end_time": "10:30",
      "duration_minutes": 90,
      "priority": 1,
      "rationale": "High-cognitive demand task scheduled first during peak morning focus."
    },
    {
      "task_id": 48,
      "title": "Order replacement monitor cables",
      "start_time": "10:45",
      "end_time": "11:00",
      "duration_minutes": 15,
      "priority": 3,
      "rationale": "Low-friction administrative errand scheduled after a short buffer."
    }
  ]
}
```
