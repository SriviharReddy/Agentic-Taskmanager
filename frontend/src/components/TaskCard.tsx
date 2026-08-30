import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Clock, 
  Sparkles, 
  Trash2, 
  Tag as TagIcon,
  CheckSquare
} from 'lucide-react';
import { Task, PriorityLevel, EisenhowerQuadrant } from '../types';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  onDelete: (id: number) => void;
  onAutoBreakdown: (taskId: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onOpenDetail,
  onDelete,
  onAutoBreakdown,
}) => {
  const isDone = task.status === 'done';

  const priorityStyles: Record<PriorityLevel, { bg: string; text: string; label: string; border: string; dot: string }> = {
    1: { bg: 'bg-rose-950/30', text: 'text-rose-300', label: 'P1 Urgent', border: 'border-rose-900/40', dot: 'bg-rose-500' },
    2: { bg: 'bg-amber-950/30', text: 'text-amber-300', label: 'P2 High', border: 'border-amber-900/40', dot: 'bg-amber-500' },
    3: { bg: 'bg-zinc-850', text: 'text-zinc-300', label: 'P3 Medium', border: 'border-zinc-750', dot: 'bg-zinc-400' },
    4: { bg: 'bg-zinc-900/60', text: 'text-zinc-500', label: 'P4 Low', border: 'border-zinc-800', dot: 'bg-zinc-600' },
  };

  const quadrantLabels: Record<EisenhowerQuadrant, string> = {
    do_first: 'Q1 · Do First',
    schedule: 'Q2 · Schedule',
    delegate: 'Q3 · Delegate',
    eliminate: 'Q4 · Eliminate',
  };

  const completedSubtasks = task.subtasks.filter((s) => s.is_completed).length;
  const totalSubtasks = task.subtasks.length;

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const isOverdue = d < now && !isDone;

    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return { formatted, isOverdue };
  };

  const dueInfo = formatDueDate(task.due_date);
  return (
    <div
      onClick={() => onOpenDetail(task)}
      className={`group relative bg-zinc-900/70 hover:bg-zinc-850/80 border rounded-xl p-3.5 shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 ${
        isDone
          ? 'border-zinc-800/50 opacity-50 bg-zinc-950/40'
          : 'border-zinc-800/80 hover:border-zinc-700'
      }`}
    >
      {/* Top row: Status checkbox & Title */}
      <div>
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task);
            }}
            className="mt-0.5 text-zinc-500 hover:text-zinc-300 transition flex-shrink-0"
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-zinc-400" />
            ) : (
              <Circle className="h-4 w-4 text-zinc-600 hover:text-zinc-400 transition" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h4
              className={`text-xs sm:text-sm font-medium tracking-tight leading-snug line-clamp-2 ${
                isDone ? 'line-through text-zinc-500' : 'text-zinc-100 group-hover:text-white'
              }`}
            >
              {task.title}
            </h4>
            {task.description && (
              <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 rounded transition hover:bg-zinc-800"
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Subtasks Progress */}
      {totalSubtasks > 0 && (
        <div className="bg-zinc-950/60 rounded-lg p-2 border border-zinc-800/60">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1 font-mono">
            <span className="flex items-center gap-1 font-sans font-medium text-zinc-300">
              <CheckSquare className="h-3 w-3 text-zinc-400" />
              Subtasks
            </span>
            <span>{completedSubtasks}/{totalSubtasks}</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-zinc-300 h-full rounded-full transition-all"
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Metadata & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/40 text-[10px]">
        {/* Priority & Quadrant */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border ${
              priorityStyles[task.priority].bg
            } ${priorityStyles[task.priority].text} ${priorityStyles[task.priority].border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityStyles[task.priority].dot}`}></span>
            {priorityStyles[task.priority].label}
          </span>

          <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded-md border border-zinc-800">
            {quadrantLabels[task.eisenhower_quadrant]}
          </span>
        </div>

        {/* Due date & Time */}
        <div className="flex items-center gap-2 text-zinc-400">
          {dueInfo && (
            <span
              className={`flex items-center gap-1 font-medium ${
                dueInfo.isOverdue ? 'text-rose-400 font-semibold' : 'text-zinc-400'
              }`}
            >
              <Calendar className="h-3 w-3 text-zinc-500" />
              {dueInfo.formatted}
            </span>
          )}

          {task.estimated_minutes > 0 && (
            <span className="flex items-center gap-0.5 text-zinc-500 font-mono">
              <Clock className="h-3 w-3 text-zinc-500" />
              {task.estimated_minutes}m
            </span>
          )}

          {totalSubtasks === 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAutoBreakdown(task.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-zinc-300 hover:text-white font-medium transition bg-zinc-850 hover:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700"
              title="Decompose into subtasks with AI"
            >
              <Sparkles className="h-2.5 w-2.5 text-zinc-400" />
              <span>Breakdown</span>
            </button>
          )}
        </div>
      </div>

      {/* Tags row */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-0.5 text-[9px] bg-zinc-950 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-850"
            >
              <TagIcon className="h-2 w-2 text-zinc-600" />
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
