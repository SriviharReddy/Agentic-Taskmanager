import React from 'react';
import { 
  Kanban, 
  Grid2X2, 
  ListOrdered, 
  CalendarClock, 
  Bot, 
  Search, 
  Plus
} from 'lucide-react';
interface HeaderProps {
  currentView: 'kanban' | 'matrix' | 'list';
  onViewChange: (view: 'kanban' | 'matrix' | 'list') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenPlanner: () => void;
  onToggleCopilot: () => void;
  isCopilotOpen: boolean;
  onOpenNewTask: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
  onOpenPlanner,
  onToggleCopilot,
  isCopilotOpen,
  onOpenNewTask,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-750 flex items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] text-zinc-100">
              <svg className="w-4 h-4 text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="4" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">Agentic Tasks</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  LangGraph
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Intelligent multi-agent task manager</p>
            </div>
          </div>

          <button
            onClick={onOpenNewTask}
            className="md:hidden flex items-center gap-1 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 px-2.5 py-1.5 rounded-lg shadow-sm transition"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {/* View Switcher & Search */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-center">
          {/* View Segmented Control */}
          <div className="flex items-center bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800/90 text-xs">
            <button
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'kanban'
                  ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Board</span>
            </button>

            <button
              onClick={() => onViewChange('matrix')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'matrix'
                  ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              <span>Eisenhower</span>
            </button>

            <button
              onClick={() => onViewChange('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'list'
                  ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-44 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200 rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenPlanner}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 shadow-sm transition hover:border-zinc-700"
            title="AI Day Planner & Scheduler"
          >
            <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
            <span>Day Planner</span>
          </button>

          <button
            onClick={onToggleCopilot}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shadow-sm ${
              isCopilotOpen
                ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
            title="Toggle AI Copilot"
          >
            <Bot className="h-3.5 w-3.5 text-zinc-400" />
            <span>AI Copilot</span>
          </button>

          <button
            onClick={onOpenNewTask}
            className="hidden md:flex items-center gap-1 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    </header>
  );
};
