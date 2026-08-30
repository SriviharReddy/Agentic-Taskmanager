from typing import TypedDict, List, Optional, Annotated, Literal
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from backend.app.schemas.task import ExtractedTaskSchema

class IngestionState(TypedDict):
    input_text: Optional[str]
    input_url: Optional[str]
    input_image_base64: Optional[str]
    input_audio_base64: Optional[str]
    timezone: str
    
    # Extraction outputs
    raw_content: Optional[str]
    extracted_tasks: List[ExtractedTaskSchema]
    
    # Deduplication & Quality check
    duplicates_detected: List[dict]
    needs_human_approval: bool
    
    # Human in the loop decision
    approval_result: Optional[bool]
    approved_tasks: List[ExtractedTaskSchema]
    
    # Commit result
    committed_task_ids: List[int]
    status: Literal["init", "extracted", "interrupted", "completed", "cancelled"]
    message: str

class CopilotState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    timezone: str
    active_filters: Optional[dict]
