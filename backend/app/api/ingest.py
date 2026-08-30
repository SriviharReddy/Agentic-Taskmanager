import uuid
from typing import List
from fastapi import APIRouter, HTTPException
from langgraph.types import Command

from backend.app.schemas.task import IngestRequest, IngestResponse, ResumeInterruptRequest, ExtractedTaskSchema
from backend.app.graphs.ingestion_graph import ingestion_graph
from backend.app.graphs.state import IngestionState

router = APIRouter(prefix="/ingest", tags=["ingest"])

@router.post("", response_model=IngestResponse)
async def ingest_content(req: IngestRequest):
    """Ingest multimodal content (text, URL, screenshot, or audio) and extract tasks."""
    if not (req.text or req.url or req.image_base64 or req.audio_base64):
        raise HTTPException(status_code=400, detail="At least one input source (text, url, image_base64, audio_base64) must be provided.")
        
    thread_id = f"ingest_{uuid.uuid4().hex[:10]}"
    config = {"configurable": {"thread_id": thread_id}}
    
    initial_state: IngestionState = {
        "input_text": req.text,
        "input_url": req.url,
        "input_image_base64": req.image_base64,
        "input_audio_base64": req.audio_base64,
        "timezone": req.timezone or "UTC",
        "raw_content": None,
        "extracted_tasks": [],
        "duplicates_detected": [],
        "needs_human_approval": False,
        "approval_result": None,
        "approved_tasks": [],
        "committed_task_ids": [],
        "status": "init",
        "message": ""
    }
    
    try:
        result = await ingestion_graph.ainvoke(initial_state, config=config)
        graph_state = await ingestion_graph.aget_state(config)
        
        # Check if paused at human-in-the-loop interrupt
        has_interrupt = bool(
            (hasattr(graph_state, "interrupts") and graph_state.interrupts)
            or (graph_state.tasks and any(task.interrupts for task in graph_state.tasks))
            or result.get("__interrupt__")
        )
        if has_interrupt:
            extracted = result.get("extracted_tasks") or graph_state.values.get("extracted_tasks", [])
            dupes = result.get("duplicates_detected") or graph_state.values.get("duplicates_detected", [])
            return IngestResponse(
                thread_id=thread_id,
                status="interrupted_review_needed",
                tasks_extracted=extracted,
                duplicates_detected=dupes,
                message="Extracted candidate tasks need user review before saving."
            )
            
        return IngestResponse(
            thread_id=thread_id,
            status="completed",
            tasks_extracted=result.get("extracted_tasks", []),
            duplicates_detected=result.get("duplicates_detected", []),
            message=result.get("message", "Task ingestion completed successfully.")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.post("/resume", response_model=IngestResponse)
async def resume_ingest_interrupt(req: ResumeInterruptRequest):
    """Resume an interrupted ingestion flow after user approval or task modification."""
    config = {"configurable": {"thread_id": req.thread_id}}
    
    payload = {
        "approved": req.approved,
        "tasks": [t.model_dump() for t in req.tasks] if req.tasks else None
    }
    
    try:
        result = await ingestion_graph.ainvoke(Command(resume=payload), config=config)
        return IngestResponse(
            thread_id=req.thread_id,
            status="completed" if req.approved else "completed",
            tasks_extracted=result.get("approved_tasks", []) or result.get("extracted_tasks", []),
            duplicates_detected=[],
            message=result.get("message", "Tasks committed successfully.")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume ingestion: {str(e)}")
