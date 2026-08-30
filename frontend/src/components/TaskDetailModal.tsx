import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Tag as TagIcon, 
  CheckCircle2, 
  Circle, 
  Loader2,
  FileText
} from 'lucide-react';
import { Task, PriorityLevel, EisenhowerQuadrant, TaskStatus } from '../types';
import { api } from '../services/api';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (id: number) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<PriorityLevel>(task.priority);
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(task.eisenhower_quadrant);
  const [dueDate, setDueDate] = useState<string>(
    task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>(task.tags.map((t) => t.name));
  
  const [isSaving, setIsSaving] = useState(false);
  const [isBreakingDown, setIsBreakingDown] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateTask(task.id, {
        title,
        description,
        status,
        priority,
        eisenhower_quadrant: quadrant,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimated_minutes: estimatedMinutes,
        tags,
      });
      onUpdate(updated);
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      await api.addSubtask(task.id, newSubtaskTitle.trim());
      const refreshed = await api.fetchTasks({ search: task.title });
      const current = refreshed.tasks.find((t) => t.id === task.id);
      if (current) onUpdate(current);
      setNewSubtaskTitle('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (subtaskId: number, currentCompleted: boolean) => {
    try {
      await api.updateSubtask(task.id, subtaskId, !currentCompleted);
      const refreshed = await api.fetchTasks({ search: task.title });
      const current = refreshed.tasks.find((t) => t.id === task.id);
      if (current) onUpdate(current);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to toggle subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      await api.deleteSubtask(task.id, subtaskId);
      const refreshed = await api.fetchTasks({ search: task.title });
      const current = refreshed.tasks.find((t) => t.id === task.id);
      if (current) onUpdate(current);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete subtask');
    }
  };

  const handleAutoBreakdown = async () => {
    setIsBreakingDown(true);
    try {
      const updated = await api.autoBreakdownTask(task.id, 4);
      onUpdate(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to break down task');
    } finally {
      setIsBreakingDown(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const clean = newTag.trim().toLowerCase();
      if (!tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter((t) => t !== tagName));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              TASK-{task.id}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              source: {task.source_type}
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-850 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium text-zinc-100 focus:outline-none focus:border-zinc-600"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Description & Context</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key notes, links, or instructions..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
            />
          </div>

          {/* Metadata Grid (Status, Priority, Quadrant, Due, Est) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Status */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as PriorityLevel)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              >
                <option value={1}>P1: Urgent & Important</option>
                <option value={2}>P2: Important, Not Urgent</option>
                <option value={3}>P3: Urgent, Not Important</option>
                <option value={4}>P4: Neither (Low)</option>
              </select>
            </div>

            {/* Eisenhower Quadrant */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Eisenhower Matrix</label>
              <select
                value={quadrant}
                onChange={(e) => setQuadrant(e.target.value as EisenhowerQuadrant)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              >
                <option value="do_first">Q1: Do First</option>
                <option value="schedule">Q2: Schedule</option>
                <option value="delegate">Q3: Delegate</option>
                <option value="eliminate">Q4: Eliminate</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-zinc-500" />
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Estimated Minutes */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-zinc-500" />
                Est. Minutes
              </label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
              <TagIcon className="h-3.5 w-3.5 text-zinc-500" />
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-xs bg-zinc-900 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-800 font-mono"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add tag and press Enter..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Subtasks / Checklist */}
          <div className="border-t border-zinc-800 pt-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-medium text-zinc-300">Actionable Checklist</label>
              <button
                type="button"
                onClick={handleAutoBreakdown}
                disabled={isBreakingDown}
                className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-850 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-800 transition hover:border-zinc-700"
              >
                {isBreakingDown ? (
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                ) : (
                  <Sparkles className="h-3 w-3 text-zinc-400" />
                )}
                <span>AI Breakdown</span>
              </button>
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5 mb-2.5">
              {task.subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id, sub.is_completed)}
                    className="flex items-center gap-2 flex-1 text-left text-xs"
                  >
                    {sub.is_completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-zinc-600 hover:text-zinc-400 flex-shrink-0" />
                    )}
                    <span className={sub.is_completed ? 'line-through text-zinc-500' : 'text-zinc-200'}>
                      {sub.title}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 rounded transition hover:bg-zinc-800"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add subtask item..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask(e);
                  }
                }}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Source Context Snippet if present */}
          {task.source_context && (
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1 font-medium text-zinc-300 mb-1">
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                Source Context
              </div>
              <p className="italic text-zinc-400 font-mono text-[10px]">{task.source_context}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-3.5">
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-950/30 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Task
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
