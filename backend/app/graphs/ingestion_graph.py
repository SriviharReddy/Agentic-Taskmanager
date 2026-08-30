import os
import json
import base64
from datetime import datetime, timezone
from typing import List, Optional, Literal
import difflib

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import MemorySaver
import httpx
import trafilatura
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.core.config import settings, get_chat_model
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.task import Task, SubTask, Tag, IngestLog
from backend.app.schemas.task import ExtractedTaskSchema, ExtractedTaskList
from backend.app.graphs.state import IngestionState

EXTRACTION_SYSTEM_PROMPT = """You are an elite executive assistant and task intelligence system.
Your job is to thoroughly analyze the user's input (which may be a brain dump, email, meeting notes, screenshot of chat/tickets/whiteboard, or webpage text) and extract ALL actionable tasks, todos, deadlines, and follow-ups.

For each task:
1. title: Clear, action-oriented (starts with an imperative verb like 'Review', 'Send', 'Build', 'Schedule', 'Call').
2. description: Any crucial context, links, names, or constraints.
3. priority: 
   - 1 = Urgent & Important (immediate crisis, today's deadline)
   - 2 = Important, Not Urgent (high strategic value, core goal)
   - 3 = Urgent, Not Important (routine admin, quick reply, errand)
   - 4 = Neither (someday/maybe, low impact)
4. eisenhower_quadrant:
   - 'do_first' (P1)
   - 'schedule' (P2)
   - 'delegate' (P3)
   - 'eliminate' (P4)
5. due_date_iso: If a date or deadline is mentioned or implied (e.g. 'tomorrow', 'by Friday', 'next week'), resolve it to an exact ISO-8601 string (e.g. 'YYYY-MM-DDTHH:MM:SSZ' or 'YYYY-MM-DD') based on the Current Reference Time provided below. If no deadline is specified, leave null.
6. estimated_minutes: Realistic estimate in minutes (e.g. 15, 30, 60, 120).
7. tags: 1-3 lowercase categories (e.g. ['work', 'email'], ['finance'], ['health', 'errand']).
8. subtasks: If the task has multiple discrete steps, break it down into 2-5 concrete checklist steps.
9. source_context: A short exact phrase or visual snippet where you found this task.

Current Reference Time: {current_time_iso}
User Timezone: {user_timezone}
"""

def _to_schema(task_obj) -> ExtractedTaskSchema:
    """Helper to convert dictionary or schema into ExtractedTaskSchema."""
    if isinstance(task_obj, ExtractedTaskSchema):
        return task_obj
    return ExtractedTaskSchema.model_validate(task_obj)

async def extract_node(state: IngestionState) -> dict:
    """Extract structured tasks from text, url, image, or audio using Gemini 3.7 Flash."""
    current_time_iso = datetime.now(timezone.utc).isoformat()
    user_tz = state.get("timezone", "UTC")
    sys_prompt = EXTRACTION_SYSTEM_PROMPT.format(
        current_time_iso=current_time_iso,
        user_timezone=user_tz
    )
    
    llm = get_chat_model(temperature=0.1)
    structured_llm = llm.with_structured_output(ExtractedTaskList)
    
    content_parts = []
    raw_content_summary = ""
    
    # 1. URL Ingestion
    if state.get("input_url"):
        url = state["input_url"]
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url)
                html_text = resp.text
                extracted_text = trafilatura.extract(html_text) or html_text[:5000]
                content_parts.append(f"Content extracted from URL ({url}):\n\n{extracted_text}")
                raw_content_summary += f"[URL: {url}]\n{extracted_text[:500]}"
        except Exception as e:
            content_parts.append(f"Failed to fetch URL {url}: {str(e)}")
            raw_content_summary += f"[URL error: {str(e)}]"

    # 2. Text Ingestion
    if state.get("input_text"):
        text = state["input_text"]
        content_parts.append(f"User Input Text:\n{text}")
        raw_content_summary += f"\n[Text]\n{text}"

    # 3. Image / Screenshot Ingestion
    message_content = []
    if content_parts:
        message_content.append({"type": "text", "text": "\n\n".join(content_parts)})
    else:
        message_content.append({"type": "text", "text": "Extract all actionable tasks from this content."})
        
    if state.get("input_image_base64"):
        img_b64 = state["input_image_base64"]
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
        })
        raw_content_summary += "\n[Image / Screenshot attached]"

    messages = [
        SystemMessage(content=sys_prompt),
        HumanMessage(content=message_content)
    ]
    
    try:
        result: ExtractedTaskList = await structured_llm.ainvoke(messages)
        tasks = result.tasks if result and hasattr(result, "tasks") else []
    except Exception as e:
        # Fallback in case of structured output parsing issues
        tasks = []
        raw_content_summary += f"\n[Extraction error: {str(e)}]"

    return {
        "raw_content": raw_content_summary,
        "extracted_tasks": tasks,
        "status": "extracted"
    }

async def dedupe_node(state: IngestionState) -> dict:
    """Detect near-duplicate tasks and determine if human-in-the-loop review is warranted."""
    extracted = state.get("extracted_tasks", [])
    if not extracted:
        return {
            "duplicates_detected": [],
            "needs_human_approval": False,
            "approved_tasks": []
        }
        
    # Query existing active tasks from database
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.status.in_(["todo", "in_progress"]))
        res = await session.execute(stmt)
        existing_tasks = res.scalars().all()
        
    duplicates = []
    for item in extracted:
        ext_task = _to_schema(item)
        ext_title_lower = ext_task.title.lower().strip()
        for ex in existing_tasks:
            ex_title_lower = ex.title.lower().strip()
            # Calculate sequence matcher similarity
            sim = difflib.SequenceMatcher(None, ext_title_lower, ex_title_lower).ratio()
            
            # Also check substring containment
            if ext_title_lower in ex_title_lower or ex_title_lower in ext_title_lower:
                sim = max(sim, 0.85)
                
            if sim >= 0.65:
                duplicates.append({
                    "extracted_title": ext_task.title,
                    "existing_id": ex.id,
                    "existing_title": ex.title,
                    "existing_status": ex.status,
                    "similarity_score": round(sim, 2)
                })
                
    # If duplicates detected or more than 3 tasks extracted, flag for human approval
    needs_approval = len(duplicates) > 0 or len(extracted) >= 3
    
    return {
        "duplicates_detected": duplicates,
        "needs_human_approval": needs_approval,
        "approved_tasks": extracted if not needs_approval else []
    }

def approval_node(state: IngestionState) -> Command[Literal["commit", "cancel"]]:
    """Human-in-the-loop review interrupt gate."""
    if not state.get("needs_human_approval", False):
        return Command(goto="commit")
        
    # Trigger LangGraph interrupt - execution pauses here until resumed with Command(resume=...)
    decision = interrupt({
        "type": "task_review_request",
        "question": "Review extracted tasks and potential duplicates before saving.",
        "extracted_tasks": [t.model_dump() if hasattr(t, "model_dump") else t for t in state.get("extracted_tasks", [])],
        "duplicates": state.get("duplicates_detected", []),
    })
    
    # After resume:
    if isinstance(decision, dict) and decision.get("approved"):
        custom_tasks_data = decision.get("tasks")
        if custom_tasks_data:
            approved_tasks = [_to_schema(t) for t in custom_tasks_data]
            return Command(goto="commit", update={"approved_tasks": approved_tasks, "approval_result": True})
        approved_tasks = [_to_schema(t) for t in state.get("extracted_tasks", [])]
        return Command(goto="commit", update={"approved_tasks": approved_tasks, "approval_result": True})
    else:
        return Command(goto="cancel", update={"approval_result": False})

async def commit_node(state: IngestionState) -> dict:
    """Save approved tasks into the SQLite database."""
    approved = state.get("approved_tasks", [])
    committed_ids = []
    
    if not approved:
        return {
            "committed_task_ids": [],
            "status": "completed",
            "message": "No tasks were committed."
        }
        
    async with AsyncSessionLocal() as session:
        for item in approved:
            t = _to_schema(item)
            due_dt = None
            if t.due_date_iso:
                try:
                    due_dt = datetime.fromisoformat(t.due_date_iso.replace("Z", "+00:00"))
                except Exception:
                    due_dt = None
                    
            db_task = Task(
                title=t.title,
                description=t.description,
                priority=t.priority,
                eisenhower_quadrant=t.eisenhower_quadrant,
                due_date=due_dt,
                estimated_minutes=t.estimated_minutes,
                source_type="ingestion",
                source_context=t.source_context or state.get("raw_content", "")[:300]
            )
            
            # Attach tags
            for tag_name in t.tags:
                clean_tag = tag_name.strip().lower()
                if clean_tag:
                    stmt = select(Tag).where(Tag.name == clean_tag)
                    res = await session.execute(stmt)
                    tag_obj = res.scalar_one_or_none()
                    if not tag_obj:
                        tag_obj = Tag(name=clean_tag)
                        session.add(tag_obj)
                    db_task.tags.append(tag_obj)
                    
            # Attach subtasks
            for idx, sub_title in enumerate(t.subtasks):
                if sub_title.strip():
                    db_task.subtasks.append(SubTask(title=sub_title.strip(), order=idx))
                    
            session.add(db_task)
            await session.flush()
            committed_ids.append(db_task.id)
            
        # Log ingestion
        ingest_log = IngestLog(
            source_type="multimodal",
            raw_content=state.get("raw_content", ""),
            extracted_count=len(committed_ids)
        )
        session.add(ingest_log)
        await session.commit()
        
    return {
        "committed_task_ids": committed_ids,
        "status": "completed",
        "message": f"Successfully created {len(committed_ids)} new tasks."
    }

def cancel_node(state: IngestionState) -> dict:
    """Handle cancelled ingestion."""
    return {
        "committed_task_ids": [],
        "status": "cancelled",
        "message": "Task ingestion was cancelled by the user."
    }

# Build and compile IngestionGraph
builder = StateGraph(IngestionState)
builder.add_node("extract", extract_node)
builder.add_node("dedupe", dedupe_node)
builder.add_node("approval", approval_node)
builder.add_node("commit", commit_node)
builder.add_node("cancel", cancel_node)

builder.add_edge(START, "extract")
builder.add_edge("extract", "dedupe")
builder.add_edge("dedupe", "approval")
builder.add_edge("commit", END)
builder.add_edge("cancel", END)

# In-memory checkpointer for thread-level HITL interrupts
checkpointer = MemorySaver()
ingestion_graph = builder.compile(checkpointer=checkpointer)
