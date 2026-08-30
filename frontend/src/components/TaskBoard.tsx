import React from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { 
  Inbox, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
interface TaskBoardProps {
  tasks: Task[];
  view: 'kanban' | 'matrix' | 'list';
  onToggleComplete: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  onDelete: (id: number) => void;
  onAutoBreakdown: (taskId: number) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  availableTags: string[];
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  view,
  onToggleComplete,
  onOpenDetail,
  onDelete,
  onAutoBreakdown,
  selectedTag,
  onSelectTag,
  availableTags,
}) => {
  // Filter by tag if selected
  const filteredTasks = selectedTag
    ? tasks.filter((t) => t.tags.some((tag) => tag.name.toLowerCase() === selectedTag.toLowerCase()))
    : tasks;

  return (
    <div className="space-y-4">
      {/* Tag filter bar */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-zinc-500 font-medium text-[11px] mr-1">Tags:</span>
          <button
            onClick={() => onSelectTag(null)}
            className={`px-2.5 py-1 rounded-md transition font-medium text-xs ${
              selectedTag === null
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
            }`}
          >
            All ({tasks.length})
          </button>
          {availableTags.map((t) => {
            const count = tasks.filter((task) => task.tags.some((tag) => tag.name.toLowerCase() === t.toLowerCase())).length;
            return (
              <button
                key={t}
                onClick={() => onSelectTag(selectedTag === t ? null : t)}
                className={`px-2.5 py-1 rounded-md transition font-medium text-xs font-mono ${
                  selectedTag === t
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                }`}
              >
                #{t} <span className="text-zinc-500">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/30 rounded-xl border border-zinc-800/80 text-center space-y-3">
          <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-200">No tasks found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Use the quick capture bar above to extract tasks from text, screenshots, URLs, or voice memos.
            </p>
          </div>
        </div>
      )}

      {/* 1. Kanban Board View */}
      {view === 'kanban' && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(
            [
              { status: 'todo', title: 'To Do', icon: Clock, dot: 'bg-zinc-400' },
              { status: 'in_progress', title: 'In Progress', icon: AlertCircle, dot: 'bg-blue-400' },
              { status: 'done', title: 'Completed', icon: CheckCircle2, dot: 'bg-emerald-400' },
            ] as const
          ).map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-3 min-h-[520px]"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`}></span>
                    <h3 className="text-xs font-semibold text-zinc-200 tracking-tight">{col.title}</h3>
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleComplete={onToggleComplete}
                      onOpenDetail={onOpenDetail}
                      onDelete={onDelete}
                      onAutoBreakdown={onAutoBreakdown}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="h-28 flex items-center justify-center border border-dashed border-zinc-800/60 rounded-lg text-xs text-zinc-600">
                      No tasks in {col.title.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Eisenhower Matrix View */}
      {view === 'matrix' && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              {
                quadrant: 'do_first',
                title: 'Q1: Do First',
                subtitle: 'Urgent & Important (critical items & immediate deadlines)',
                dot: 'bg-rose-500',
                badgeBg: 'bg-rose-950/30 text-rose-300 border-rose-900/40',
              },
              {
                quadrant: 'schedule',
                title: 'Q2: Schedule',
                subtitle: 'Important, Not Urgent (deep work, strategy & core goals)',
                dot: 'bg-amber-500',
                badgeBg: 'bg-amber-950/30 text-amber-300 border-amber-900/40',
              },
              {
                quadrant: 'delegate',
                title: 'Q3: Delegate',
                subtitle: 'Urgent, Not Important (routine requests & interruptions)',
                dot: 'bg-blue-400',
                badgeBg: 'bg-blue-950/30 text-blue-300 border-blue-900/40',
              },
              {
                quadrant: 'eliminate',
                title: 'Q4: Eliminate',
                subtitle: 'Low Impact (non-urgent busywork & backlog)',
                dot: 'bg-zinc-500',
                badgeBg: 'bg-zinc-900 text-zinc-400 border-zinc-800',
              },
            ] as const
          ).map((quad) => {
            const quadTasks = filteredTasks.filter((t) => t.eisenhower_quadrant === quad.quadrant);
            return (
              <div
                key={quad.quadrant}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col gap-3 min-h-[350px]"
              >
                <div className="flex items-start justify-between border-b border-zinc-800/80 pb-2.5">
                  <div className="flex items-start gap-2">
                    <span className={`h-2 w-2 rounded-full mt-1.5 ${quad.dot}`}></span>
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 tracking-tight">{quad.title}</h3>
                      <p className="text-[10px] text-zinc-500">{quad.subtitle}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${quad.badgeBg}`}>
                    {quadTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[450px]">
                  {quadTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleComplete={onToggleComplete}
                      onOpenDetail={onOpenDetail}
                      onDelete={onDelete}
                      onAutoBreakdown={onAutoBreakdown}
                    />
                  ))}
                  {quadTasks.length === 0 && (
                    <div className="h-24 flex items-center justify-center border border-dashed border-zinc-800/60 rounded-lg text-xs text-zinc-600">
                      No tasks in this quadrant
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. List View */}
      {view === 'list' && filteredTasks.length > 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onOpenDetail={onOpenDetail}
              onDelete={onDelete}
              onAutoBreakdown={onAutoBreakdown}
            />
          ))}
        </div>
      )}
    </div>
  );
};
