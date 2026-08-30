from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, delete
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.models.task import Task, SubTask, Tag, task_tags
from backend.app.schemas.task import (
    TaskRead, TaskCreate, TaskUpdate, TaskListResponse,
    SubTaskRead, SubTaskCreate, SubTaskUpdate, TagRead
)
from backend.app.core.config import settings, get_chat_model
from pydantic import BaseModel

router = APIRouter(prefix="/tasks", tags=["tasks"])

def _get_eisenhower_quadrant(priority: int) -> str:
    mapping = {
        1: "do_first",
        2: "schedule",
        3: "delegate",
        4: "eliminate"
    }
    return mapping.get(priority, "schedule")

@router.get("", response_model=TaskListResponse)
async def get_tasks(
    status: Optional[str] = Query(None, description="todo, in_progress, done, archived"),
    priority: Optional[int] = Query(None, ge=1, le=4),
    eisenhower_quadrant: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve tasks with multi-field filtering, search, and relationship prefetching."""
    stmt = select(Task).options(
        selectinload(Task.subtasks),
        selectinload(Task.tags)
    )
    
    conditions = []
    if status:
        conditions.append(Task.status == status)
    if priority:
        conditions.append(Task.priority == priority)
    if eisenhower_quadrant:
        conditions.append(Task.eisenhower_quadrant == eisenhower_quadrant)
    if search:
        search_filter = f"%{search}%"
        conditions.append(or_(Task.title.ilike(search_filter), Task.description.ilike(search_filter)))
    if tag:
        stmt = stmt.join(Task.tags).where(Tag.name == tag.lower())
        
    if conditions:
        stmt = stmt.where(and_(*conditions))
        
    # Sort order: Status (todo/in_progress first), Priority asc (1=Urgent), Due date asc
    stmt = stmt.order_by(
        Task.status.desc(), # 'todo', 'in_progress' appear prominently
        Task.priority.asc(),
        Task.due_date.asc().nullslast()
    )
    
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    return TaskListResponse(total=len(tasks), tasks=tasks)

@router.post("", response_model=TaskRead)
async def create_task_endpoint(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new task with nested tags and checklist subtasks."""
    quadrant = task_in.eisenhower_quadrant or _get_eisenhower_quadrant(task_in.priority)
    
    db_task = Task(
        title=task_in.title,
        description=task_in.description,
        status=task_in.status,
        priority=task_in.priority,
        eisenhower_quadrant=quadrant,
        due_date=task_in.due_date,
        estimated_minutes=task_in.estimated_minutes,
        source_type=task_in.source_type,
        source_context=task_in.source_context
    )
    
    # Process Tags
    for tag_name in task_in.tags:
        clean_tag = tag_name.strip().lower()
        if clean_tag:
            tag_res = await db.execute(select(Tag).where(Tag.name == clean_tag))
            tag_obj = tag_res.scalar_one_or_none()
            if not tag_obj:
                tag_obj = Tag(name=clean_tag)
                db.add(tag_obj)
            db_task.tags.append(tag_obj)
            
    # Process Subtasks
    for idx, sub_title in enumerate(task_in.subtasks):
        if sub_title.strip():
            db_task.subtasks.append(SubTask(title=sub_title.strip(), order=idx))
            
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

@router.get("/{task_id}", response_model=TaskRead)
async def get_task_by_id(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get single task details with subtasks and tags."""
    stmt = select(Task).options(selectinload(Task.subtasks), selectinload(Task.tags)).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.patch("/{task_id}", response_model=TaskRead)
async def update_task_endpoint(
    task_id: int,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update task properties."""
    stmt = select(Task).options(selectinload(Task.subtasks), selectinload(Task.tags)).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = task_update.model_dump(exclude_unset=True)
    
    if "tags" in update_data:
        tags_list = update_data.pop("tags")
        task.tags.clear()
        for tag_name in (tags_list or []):
            clean_tag = tag_name.strip().lower()
            if clean_tag:
                tag_res = await db.execute(select(Tag).where(Tag.name == clean_tag))
                tag_obj = tag_res.scalar_one_or_none()
                if not tag_obj:
                    tag_obj = Tag(name=clean_tag)
                    db.add(tag_obj)
                task.tags.append(tag_obj)
                
    if "status" in update_data:
        if update_data["status"] == "done" and task.status != "done":
            task.completed_at = datetime.now(timezone.utc)
        elif update_data["status"] != "done":
            task.completed_at = None
            
    if "priority" in update_data and "eisenhower_quadrant" not in update_data:
        task.eisenhower_quadrant = _get_eisenhower_quadrant(update_data["priority"])
        
    for field, value in update_data.items():
        setattr(task, field, value)
        
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{task_id}")
async def delete_task_endpoint(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a task and associated subtasks."""
    stmt = select(Task).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await db.delete(task)
    await db.commit()
    return {"status": "deleted", "id": task_id}

# --- Subtask Endpoints ---

@router.post("/{task_id}/subtasks", response_model=SubTaskRead)
async def add_subtask(
    task_id: int,
    subtask_in: SubTaskCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a subtask checklist item to a task."""
    task_res = await db.execute(select(Task).where(Task.id == task_id))
    if not task_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Parent task not found")
        
    subtask = SubTask(
        task_id=task_id,
        title=subtask_in.title,
        is_completed=subtask_in.is_completed,
        order=subtask_in.order
    )
    db.add(subtask)
    await db.commit()
    await db.refresh(subtask)
    return subtask

@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubTaskRead)
async def update_subtask(
    task_id: int,
    subtask_id: int,
    subtask_in: SubTaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Toggle completion or edit a subtask."""
    stmt = select(SubTask).where(SubTask.id == subtask_id, SubTask.task_id == task_id)
    res = await db.execute(stmt)
    subtask = res.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
        
    update_data = subtask_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subtask, field, value)
        
    await db.commit()
    await db.refresh(subtask)
    return subtask

@router.delete("/{task_id}/subtasks/{subtask_id}")
async def delete_subtask(
    task_id: int,
    subtask_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a subtask."""
    stmt = select(SubTask).where(SubTask.id == subtask_id, SubTask.task_id == task_id)
    res = await db.execute(stmt)
    subtask = res.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
        
    await db.delete(subtask)
    await db.commit()
    return {"status": "deleted", "id": subtask_id}

# --- AI Task Breakdown Endpoint ---

class BreakdownResponse(BaseModel):
    task_id: int
    steps: List[str]

class BreakdownSchema(BaseModel):
    steps: List[str]

@router.post("/{task_id}/breakdown", response_model=TaskRead)
async def auto_breakdown_task(
    task_id: int,
    num_steps: int = Query(4, ge=2, le=8),
    db: AsyncSession = Depends(get_db)
):
    """Use Gemini 3.7 Flash to decompose a high-level task into concrete subtasks."""
    stmt = select(Task).options(selectinload(Task.subtasks), selectinload(Task.tags)).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    prompt = f"""Decompose the following task into {num_steps} actionable, sequential checklist steps.
Task Title: {task.title}
Description: {task.description or 'None'}

Return concise, imperative subtasks (e.g. 'Gather requirements', 'Draft outline', 'Review with lead')."""

    try:
        llm = get_chat_model(temperature=0.2)
        structured_llm = llm.with_structured_output(BreakdownSchema)
        result = await structured_llm.ainvoke(prompt)
        
        current_len = len(task.subtasks)
        for i, step_text in enumerate(result.steps):
            if step_text.strip():
                sub = SubTask(task_id=task.id, title=step_text.strip(), order=current_len + i)
                db.add(sub)
                
        await db.commit()
        await db.refresh(task)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI breakdown failed: {str(e)}")
        
    return task

@router.get("/tags/all", response_model=List[TagRead])
async def get_all_tags(db: AsyncSession = Depends(get_db)):
    """Retrieve all available tags."""
    res = await db.execute(select(Tag).order_by(Tag.name.asc()))
    return res.scalars().all()
