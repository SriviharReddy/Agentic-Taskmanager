import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { QuickCapture } from './components/QuickCapture';
import { TaskBoard } from './components/TaskBoard';
import { TaskDetailModal } from './components/TaskDetailModal';
import { DayPlannerModal } from './components/DayPlannerModal';
import { CopilotDrawer } from './components/CopilotDrawer';
import { InterruptModal } from './components/InterruptModal';
import { Task, IngestResponse, TaskCreateInput } from './types';
import { api } from './services/api';
import { Loader2, Plus, X } from 'lucide-react';

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [currentView, setCurrentView] = useState<'kanban' | 'matrix' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals & Drawers state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [interruptData, setInterruptData] = useState<IngestResponse | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<1 | 2 | 3 | 4>(3);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.fetchTasks({
        search: searchQuery || undefined,
        tag: selectedTag || undefined,
      });
      setTasks(res.tasks);

      // Extract unique tags
      const tagRes = await api.fetchTags();
      setAvailableTags(tagRes.map((t) => t.name));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTag]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleComplete = async (task: Task) => {
    try {
      const nextStatus = task.status === 'done' ? 'todo' : 'done';
      await api.updateTask(task.id, { status: nextStatus });
      loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await api.deleteTask(id);
      loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleAutoBreakdown = async (taskId: number) => {
    try {
      await api.autoBreakdownTask(taskId, 4);
      loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'AI breakdown failed');
    }
  };

  const handleIngestSuccess = (res: IngestResponse) => {
    if (res.status === 'interrupted_review_needed') {
      setInterruptData(res);
    } else {
      loadTasks();
    }
  };

  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const payload: TaskCreateInput = {
        title: newTitle.trim(),
        priority: newPriority,
        status: 'todo',
      };
      await api.createTask(payload);
      setNewTitle('');
      setIsNewTaskOpen(false);
      loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col antialiased">
      {/* Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenPlanner={() => setIsPlannerOpen(true)}
        onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        isCopilotOpen={isCopilotOpen}
        onOpenNewTask={() => setIsNewTaskOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5 space-y-5">
        {/* Quick Multimodal Capture Bar */}
        <QuickCapture
          onIngestSuccess={handleIngestSuccess}
          onRefreshTasks={loadTasks}
        />

        {/* Status / Loading indicator */}
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center p-16 text-zinc-400 gap-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            <span className="text-xs font-medium">Fetching tasks...</span>
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadTasks} className="text-xs underline hover:text-white ml-2">Retry</button>
          </div>
        ) : (
          /* Task Board (Kanban, Matrix, or List) */
          <TaskBoard
            tasks={tasks}
            view={currentView}
            onToggleComplete={handleToggleComplete}
            onOpenDetail={setActiveTask}
            onDelete={handleDeleteTask}
            onAutoBreakdown={handleAutoBreakdown}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            availableTags={availableTags}
          />
        )}
      </main>

      {/* Task Detail Modal */}
      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onUpdate={() => {
            setActiveTask(null);
            loadTasks();
          }}
          onDelete={handleDeleteTask}
        />
      )}

      {/* LangGraph Interrupt / Review Modal */}
      {interruptData && (
        <InterruptModal
          ingestData={interruptData}
          onClose={() => setInterruptData(null)}
          onSuccess={() => {
            setInterruptData(null);
            loadTasks();
          }}
        />
      )}

      {/* Day Planner Modal */}
      {isPlannerOpen && (
        <DayPlannerModal
          onClose={() => setIsPlannerOpen(false)}
          pendingTasksCount={pendingCount}
        />
      )}

      {/* Quick New Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">Create New Task</h3>
              <button onClick={() => setIsNewTaskOpen(false)} className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-850 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Prepare client deck for review"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                >
                  <option value={1}>P1: Urgent & Important</option>
                  <option value={2}>P2: Important, Not Urgent</option>
                  <option value={3}>P3: Urgent, Not Important</option>
                  <option value={4}>P4: Neither (Low)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        onRefreshTasks={loadTasks}
      />
    </div>
  );
}

export default App;
