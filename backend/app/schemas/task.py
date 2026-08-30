from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

# --- SubTask Schemas ---
class SubTaskBase(BaseModel):
    title: str
    is_completed: bool = False
    order: int = 0

class SubTaskCreate(SubTaskBase):
    pass

class SubTaskUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None

class SubTaskRead(SubTaskBase):
    id: int
    task_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Tag Schemas ---
class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class TagRead(TagBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Literal["todo", "in_progress", "done", "archived"] = "todo"
    priority: int = Field(default=3, ge=1, le=4, description="1: Urgent/Important, 2: Important, 3: Urgent, 4: Neither")
    eisenhower_quadrant: Optional[Literal["do_first", "schedule", "delegate", "eliminate"]] = None
    due_date: Optional[datetime] = None
    estimated_minutes: int = 15
    source_type: str = "manual"
    source_context: Optional[str] = None

class TaskCreate(TaskBase):
    tags: List[str] = Field(default_factory=list)
    subtasks: List[str] = Field(default_factory=list)

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "done", "archived"]] = None
    priority: Optional[int] = Field(default=None, ge=1, le=4)
    eisenhower_quadrant: Optional[Literal["do_first", "schedule", "delegate", "eliminate"]] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    tags: Optional[List[str]] = None

class TaskRead(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    subtasks: List[SubTaskRead] = Field(default_factory=list)
    tags: List[TagRead] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)

class TaskListResponse(BaseModel):
    total: int
    tasks: List[TaskRead]

# --- Ingestion & AI Schemas ---
class ExtractedTaskSchema(BaseModel):
    title: str = Field(description="Action-oriented task title")
    description: Optional[str] = Field(default=None, description="Detailed context or instructions")
    priority: int = Field(default=3, ge=1, le=4, description="1: Urgent & Important, 2: Important (not urgent), 3: Urgent (not important), 4: Low priority")
    eisenhower_quadrant: Literal["do_first", "schedule", "delegate", "eliminate"] = Field(
        default="schedule",
        description="do_first: P1 (urgent+important), schedule: P2 (important), delegate: P3 (urgent), eliminate: P4 (neither)"
    )
    due_date_iso: Optional[str] = Field(default=None, description="Resolved ISO-8601 string e.g. 2026-09-01T15:00:00Z or YYYY-MM-DD")
    estimated_minutes: int = Field(default=15, description="Estimated duration in minutes")
    tags: List[str] = Field(default_factory=list, description="Categorical tags e.g. ['work', 'finance', 'errand']")
    subtasks: List[str] = Field(default_factory=list, description="Actionable checklist steps")
    source_context: Optional[str] = Field(default=None, description="Exact phrase or snippet source")

class ExtractedTaskList(BaseModel):
    tasks: List[ExtractedTaskSchema] = Field(description="List of extracted tasks found in content")

class IngestRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    image_base64: Optional[str] = None
    audio_base64: Optional[str] = None
    timezone: str = "UTC"

class IngestResponse(BaseModel):
    thread_id: str
    status: Literal["completed", "interrupted_review_needed"]
    tasks_extracted: List[ExtractedTaskSchema]
    duplicates_detected: List[dict] = Field(default_factory=list)
    message: str

class ResumeInterruptRequest(BaseModel):
    thread_id: str
    approved: bool
    tasks: Optional[List[ExtractedTaskSchema]] = None

# --- Day Planner Schemas ---
class DayPlanRequest(BaseModel):
    available_hours: float = Field(default=4.0, ge=0.5, le=16.0)
    focus_mode: Literal["balanced", "high_impact", "quick_wins", "deadline_driven"] = "balanced"
    current_time_iso: Optional[str] = None

class DayPlanItem(BaseModel):
    task_id: int
    title: str
    start_time: str
    end_time: str
    duration_minutes: int
    priority: int
    rationale: str

class DayPlanResponse(BaseModel):
    summary: str
    total_planned_minutes: int
    schedule: List[DayPlanItem]
    unplanned_tasks_count: int

# --- Chat & Copilot Schemas ---
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    timezone: str = "UTC"
