from datetime import datetime, timezone
from typing import List, Optional
from langchain_core.tools import tool
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.task import Task, SubTask, Tag
from backend.app.core.config import settings

def _get_eisenhower_quadrant(priority: int) -> str:
    mapping = {
        1: "do_first",   # Urgent & Important
        2: "schedule",   # Important, Not Urgent
        3: "delegate",   # Urgent, Not Important
        4: "eliminate"   # Neither
    }
    return mapping.get(priority, "schedule")

@tool
async def create_task(
    title: str,
    description: str = "",
    priority: int = 3,
    due_date_iso: str = "",
    estimated_minutes: int = 15,
    tags: Optional[List[str]] = None,
    subtasks: Optional[List[str]] = None
) -> str:
    """Create a new task with optional description, priority (1=Urgent&Important, 2=Important, 3=Urgent, 4=Low), due date (ISO string), estimated minutes, tags, and checklist subtasks."""
    async with AsyncSessionLocal() as session:
        due_dt = None
        if due_date_iso:
            try:
                due_dt = datetime.fromisoformat(due_date_iso.replace("Z", "+00:00"))
            except Exception:
                due_dt = None
        
        quadrant = _get_eisenhower_quadrant(priority)
        task = Task(
            title=title,
            description=description if description else None,
            priority=priority,
            eisenhower_quadrant=quadrant,
            due_date=due_dt,
            estimated_minutes=estimated_minutes,
            source_type="chat"
        )
        
        if tags:
            for tag_name in tags:
                clean_tag = tag_name.strip().lower()
                if clean_tag:
                    stmt = select(Tag).where(Tag.name == clean_tag)
                    res = await session.execute(stmt)
                    tag = res.scalar_one_or_none()
                    if not tag:
                        tag = Tag(name=clean_tag)
                        session.add(tag)
                    task.tags.append(tag)
        
        if subtasks:
            for idx, sub_title in enumerate(subtasks):
                if sub_title.strip():
                    subtask = SubTask(title=sub_title.strip(), order=idx)
                    task.subtasks.append(subtask)
        
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return f"Successfully created task #{task.id}: '{task.title}' (Priority: {task.priority}, Quadrant: {task.eisenhower_quadrant}, Due: {task.due_date or 'None'})."

@tool
async def list_tasks(
    status: str = "todo",
    priority: int = 0,
    search_query: str = ""
) -> str:
    """List tasks filtered by status ('todo', 'in_progress', 'done', 'all'), optional priority (1-4), or search keyword."""
    async with AsyncSessionLocal() as session:
        stmt = select(Task).options(selectinload(Task.subtasks), selectinload(Task.tags))
        
        if status != "all":
            stmt = stmt.where(Task.status == status)
        if priority in [1, 2, 3, 4]:
            stmt = stmt.where(Task.priority == priority)
        if search_query:
            stmt = stmt.where(Task.title.ilike(f"%{search_query}%"))
            
        stmt = stmt.order_by(Task.priority.asc(), Task.due_date.asc().nullslast())
        res = await session.execute(stmt)
        tasks = res.scalars().all()
        
        if not tasks:
            return f"No tasks found matching status='{status}', priority={priority or 'any'}, search='{search_query}'."
            
        lines = []
        for t in tasks:
            tags_str = f" [{', '.join(tag.name for tag in t.tags)}]" if t.tags else ""
            sub_count = len(t.subtasks)
            sub_str = f" ({sub_count} subtasks)" if sub_count > 0 else ""
            due_str = f" | Due: {t.due_date.strftime('%Y-%m-%d %H:%M')}" if t.due_date else ""
            lines.append(f"- #{t.id} [{t.status.upper()}] (P{t.priority}) {t.title}{tags_str}{sub_str}{due_str}")
            
        return "\n".join(lines)

@tool
async def complete_task(task_id: int) -> str:
    """Mark a task as completed by its integer ID."""
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.id == task_id)
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        
        if not task:
            return f"Error: Task with ID {task_id} not found."
            
        task.status = "done"
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        return f"Task #{task_id} ('{task.title}') marked as completed!"

@tool
async def update_task(
    task_id: int,
    title: str = "",
    status: str = "",
    priority: int = 0,
    due_date_iso: str = "",
    estimated_minutes: int = 0
) -> str:
    """Update properties of an existing task by ID (title, status, priority, due date, estimated minutes)."""
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.id == task_id)
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        
        if not task:
            return f"Error: Task #{task_id} not found."
            
        if title:
            task.title = title
        if status in ["todo", "in_progress", "done", "archived"]:
            task.status = status
            if status == "done":
                task.completed_at = datetime.now(timezone.utc)
            elif status in ["todo", "in_progress"]:
                task.completed_at = None
        if priority in [1, 2, 3, 4]:
            task.priority = priority
            task.eisenhower_quadrant = _get_eisenhower_quadrant(priority)
        if due_date_iso:
            try:
                task.due_date = datetime.fromisoformat(due_date_iso.replace("Z", "+00:00"))
            except Exception:
                pass
        if estimated_minutes > 0:
            task.estimated_minutes = estimated_minutes
            
        await session.commit()
        return f"Task #{task_id} updated successfully: '{task.title}' (Status: {task.status}, P{task.priority}, Due: {task.due_date})."

@tool
async def delete_task(task_id: int) -> str:
    """Delete a task by its ID."""
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.id == task_id)
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        
        if not task:
            return f"Error: Task #{task_id} not found."
            
        await session.delete(task)
        await session.commit()
        return f"Task #{task_id} ('{task.title}') has been deleted."

@tool
async def breakdown_task(task_id: int, steps: List[str]) -> str:
    """Add a list of concrete checklist subtasks to an existing task to break down its complexity."""
    async with AsyncSessionLocal() as session:
        stmt = select(Task).options(selectinload(Task.subtasks)).where(Task.id == task_id)
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        
        if not task:
            return f"Error: Task #{task_id} not found."
            
        current_count = len(task.subtasks)
        for i, step in enumerate(steps):
            if step.strip():
                subtask = SubTask(task_id=task.id, title=step.strip(), order=current_count + i)
                session.add(subtask)
                
        await session.commit()
        return f"Added {len(steps)} subtasks to Task #{task_id} ('{task.title}')."

all_task_tools = [
    create_task,
    list_tasks,
    complete_task,
    update_task,
    delete_task,
    breakdown_task
]
