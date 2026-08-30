import React, { useState } from 'react';
import { 
  CalendarClock, 
  Sparkles, 
  X, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert 
} from 'lucide-react';
import { DayPlanResponse } from '../types';
import { api } from '../services/api';

interface DayPlannerModalProps {
  onClose: () => void;
  pendingTasksCount: number;
}

export const DayPlannerModal: React.FC<DayPlannerModalProps> = ({
  onClose,
  pendingTasksCount,
}) => {
  const [availableHours, setAvailableHours] = useState(4.0);
  const [focusMode, setFocusMode] = useState<'balanced' | 'high_impact' | 'quick_wins' | 'deadline_driven'>('balanced');
  const [planResult, setPlanResult] = useState<DayPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.generateDaySchedule({
        available_hours: availableHours,
        focus_mode: focusMode,
      });
      setPlanResult(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">AI Daily Schedule & Timebox Planner</h3>
              <p className="text-[11px] text-zinc-500">
                Optimizes your day across {pendingTasksCount} pending tasks using priority heuristics.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-850 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-950/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hours Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                <span>Available Focus Time</span>
                <span className="text-zinc-100 font-mono font-medium">{availableHours} hrs ({availableHours * 60} mins)</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={availableHours}
                onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
                className="w-full accent-zinc-100 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Focus Strategy */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Focus Strategy</label>
              <select
                value={focusMode}
                onChange={(e) => setFocusMode(e.target.value as 'balanced' | 'high_impact' | 'quick_wins' | 'deadline_driven')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              >
                <option value="balanced">Balanced (Core impact + quick wins)</option>
                <option value="high_impact">High Impact (Deep work on P1 & P2)</option>
                <option value="quick_wins">Quick Wins (High velocity short tasks)</option>
                <option value="deadline_driven">Deadline Driven (Imminent deadlines first)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || pendingTasksCount === 0}
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                <span>Optimizing schedule with Gemini 3.7 Flash...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-zinc-800" />
                <span>Generate Optimized Schedule</span>
              </>
            )}
          </button>
        </div>

        {/* Results Timeline */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {planResult && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-zinc-300" />
                    Schedule Strategy Summary
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px]">
                    Planned: <strong className="text-zinc-100">{planResult.total_planned_minutes} mins</strong> ({planResult.schedule.length} blocks)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{planResult.summary}</p>
              </div>

              {/* Chronological Schedule Blocks */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Chronological Timebox Schedule
                </h4>

                <div className="space-y-2 relative before:absolute before:left-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
                  {planResult.schedule.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-start gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 hover:border-zinc-750 transition ml-2"
                    >
                      {/* Time pill */}
                      <div className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-center flex-shrink-0 z-10 w-20">
                        <span className="text-[11px] font-mono font-medium text-zinc-100">{item.start_time}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">{item.end_time}</span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-zinc-100">{item.title}</h5>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {item.duration_minutes} mins
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          <span className="text-zinc-500 font-medium">Rationale:</span> {item.rationale}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!planResult && !isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 space-y-2">
              <Clock className="h-6 w-6 text-zinc-600" />
              <p className="text-xs">Adjust your focus hours and click Generate to see your personalized schedule.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
