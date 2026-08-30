import json
import uuid
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from backend.app.schemas.task import ChatRequest
from backend.app.graphs.copilot_graph import copilot_graph

router = APIRouter(prefix="/chat", tags=["chat"])

async def event_generator(req: ChatRequest) -> AsyncGenerator[str, None]:
    thread_id = req.thread_id or f"chat_{uuid.uuid4().hex[:10]}"
    config = {"configurable": {"thread_id": thread_id}}
    
    input_message = HumanMessage(content=req.message)
    state_input = {
        "messages": [input_message],
        "timezone": req.timezone or "UTC"
    }
    
    # Send thread_id metadata first
    yield f"data: {json.dumps({'type': 'init', 'thread_id': thread_id})}\n\n"
    
    try:
        async for event in copilot_graph.astream_events(state_input, config=config, version="v2"):
            event_kind = event.get("event")
            
            if event_kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    # Some chunks can be lists if multimodal, handle text content
                    text_content = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
                    payload = {"type": "token", "content": text_content}
                    yield f"data: {json.dumps(payload)}\n\n"
                    
            elif event_kind == "on_tool_start":
                tool_name = event.get("name", "tool")
                tool_input = event.get("data", {}).get("input", {})
                payload = {"type": "tool_start", "name": tool_name, "args": tool_input}
                yield f"data: {json.dumps(payload)}\n\n"
                
            elif event_kind == "on_tool_end":
                tool_name = event.get("name", "tool")
                tool_output = event.get("data", {}).get("output", "")
                # Clean or stringify output if necessary
                out_str = str(tool_output) if not isinstance(tool_output, str) else tool_output
                payload = {"type": "tool_end", "name": tool_name, "output": out_str}
                yield f"data: {json.dumps(payload)}\n\n"
                
        yield f"data: {json.dumps({'type': 'done', 'thread_id': thread_id})}\n\n"
    except Exception as e:
        error_payload = {"type": "error", "message": str(e)}
        yield f"data: {json.dumps(error_payload)}\n\n"

@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """Conversational Task Copilot streaming endpoint over Server-Sent Events (SSE)."""
    return StreamingResponse(
        event_generator(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
