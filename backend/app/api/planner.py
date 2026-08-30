from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from langchain_core.messages import SystemMessage, HumanMessage

from backend.app.core.database import get_db
from backend.app.models.task import Task
from backend.app.schemas.task import DayPlanRequest, DayPlanResponse, DayPlanItem
from backend.app.core.config import settings, get_chat_model

router = APIRouter(prefix="/planner", tags=["planner"])

PLANNER_PROMPT = """You are an expert executive time-management coach and scheduler.
Analyze the user's pending tasks and construct an optimal, realistic, timeboxed schedule for their workday.

Rules:
1. Available Hours: Total focused work time is {available_hours} hours.
2. Focus Mode: {focus_mode}
   - 'balanced': Mix of 1-2 high-impact tasks and a few quick wins/errands.
   - 'high_impact': Dedicate large focus blocks to Priority 1 (Urgent/Important) and Priority 2 (Important).
   - 'quick_wins': Knock out short, high-velocity tasks (<= 30 mins) first.
   - 'deadline_driven': Prioritize tasks with imminent due dates.
3. Realistic Buffers: Include small 10-15 minute mental buffers between intense tasks.
4. Output format: Provide a structured breakdown with start/end time, duration, and rationale for why each task was scheduled when.

Current Time: {current_time}
"""

@router.post("/day-schedule", response_model=DayPlanResponse)
async def generate_day_schedule(
    req: DayPlanRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate an AI-optimized daily timebox plan from active tasks."""
    stmt = select(Task).options(selectinload(Task.subtasks), selectinload(Task.tags)).where(
        Task.status.in_(["todo", "in_progress"])
    ).order_by(Task.priority.asc(), Task.due_date.asc().nullslast())
    
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    
    if not tasks:
        return DayPlanResponse(
            summary="You have no pending tasks! Enjoy your free time or add new tasks.",
            total_planned_minutes=0,
            schedule=[],
            unplanned_tasks_count=0
        )
        
    tasks_summary = []
    for t in tasks:
        due_str = t.due_date.strftime("%Y-%m-%d %H:%M") if t.due_date else "No due date"
        tags_str = ", ".join(tag.name for tag in t.tags) if t.tags else "none"
        tasks_summary.append(
            f"- Task #{t.id}: '{t.title}' | Priority: P{t.priority} ({t.eisenhower_quadrant}) | "
            f"Est: {t.estimated_minutes}m | Due: {due_str} | Tags: [{tags_str}] | "
            f"Description: {t.description or 'None'}"
        )
        
    cur_time = req.current_time_iso or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    sys_prompt = PLANNER_PROMPT.format(
        available_hours=req.available_hours,
        focus_mode=req.focus_mode,
        current_time=cur_time
    )
    
    user_prompt = "Here are my current pending tasks:\n\n" + "\n".join(tasks_summary)
    
    try:
        llm = get_chat_model(temperature=0.2)
        structured_llm = llm.with_structured_output(DayPlanResponse)
        response: DayPlanResponse = await structured_llm.ainvoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=user_prompt)
        ])
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate day schedule: {str(e)}")
