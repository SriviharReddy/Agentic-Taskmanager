from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    
    tasks = relationship("Task", secondary=task_tags, back_populates="tags")

class SubTask(Base):
    __tablename__ = "subtasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    is_completed = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    
    task = relationship("Task", back_populates="subtasks")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="todo", index=True) # todo, in_progress, done, archived
    priority = Column(Integer, default=3, index=True) # 1: Urgent & Important, 2: Important, 3: Urgent, 4: Neither
    eisenhower_quadrant = Column(String(20), default="schedule") # do_first, schedule, delegate, eliminate
    due_date = Column(DateTime, nullable=True, index=True)
    estimated_minutes = Column(Integer, default=15)
    
    source_type = Column(String(50), default="manual") # manual, chat, screenshot, url, audio
    source_context = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(DateTime, nullable=True)
    
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan", lazy="selectin")
    tags = relationship("Tag", secondary=task_tags, back_populates="tasks", lazy="selectin")

class IngestLog(Base):
    __tablename__ = "ingest_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)
    raw_content = Column(Text, nullable=True)
    extracted_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
