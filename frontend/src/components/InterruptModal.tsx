import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Trash2, 
  Loader2, 
  Copy 
} from 'lucide-react';
import { IngestResponse, ExtractedTask } from '../types';
import { api } from '../services/api';

interface InterruptModalProps {
  ingestData: IngestResponse;
  onClose: () => void;
  onSuccess: (committedCount: number) => void;
}

export const InterruptModal: React.FC<InterruptModalProps> = ({
  ingestData,
  onClose,
  onSuccess,
}) => {
  const [candidateTasks, setCandidateTasks] = useState<ExtractedTask[]>(ingestData.tasks_extracted);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateCandidate = (index: number, updatedField: Partial<ExtractedTask>) => {
    const updated = [...candidateTasks];
    updated[index] = { ...updated[index], ...updatedField };
    setCandidateTasks(updated);
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidateTasks(candidateTasks.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.resumeIngestInterrupt({
        thread_id: ingestData.thread_id,
        approved: true,
        tasks: candidateTasks,
      });
      onSuccess(res.tasks_extracted.length);
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to commit tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await api.resumeIngestInterrupt({
        thread_id: ingestData.thread_id,
        approved: false,
      });
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">Review Candidate Tasks</h3>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  LangGraph Interrupt
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                The agent extracted multiple tasks or identified potential duplicates against your database.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-850 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Duplicate Warnings banner if any */}
          {ingestData.duplicates_detected && ingestData.duplicates_detected.length > 0 && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                <span>Potential Duplicates Detected with Existing Tasks:</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {ingestData.duplicates_detected.map((dup, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-800 text-[11px]">
                    <div>
                      <span className="text-zinc-200 font-medium">"{dup.extracted_title}"</span> matches Task #{dup.existing_id} <strong className="text-zinc-400 font-normal">"{dup.existing_title}"</strong>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono text-[10px]">
                      {Math.round(dup.similarity_score * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted candidate tasks editor */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Candidate Tasks to Create ({candidateTasks.length})
            </h4>

            {candidateTasks.map((task, idx) => (
              <div
                key={idx}
                className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 space-y-2 relative group hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => handleUpdateCandidate(idx, { title: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-100 focus:outline-none focus:border-zinc-600"
                    />
                    {task.description && (
                      <textarea
                        rows={2}
                        value={task.description}
                        onChange={(e) => handleUpdateCandidate(idx, { description: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCandidate(idx)}
                    className="text-zinc-500 hover:text-rose-400 p-1 rounded-md hover:bg-zinc-800 transition"
                    title="Remove candidate task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Badges and details */}
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <select
                    value={task.priority}
                    onChange={(e) => handleUpdateCandidate(idx, { priority: Number(e.target.value) as 1 | 2 | 3 | 4 })}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-zinc-300 font-medium"
                  >
                    <option value={1}>P1: Urgent/Important</option>
                    <option value={2}>P2: Important</option>
                    <option value={3}>P3: Urgent</option>
                    <option value={4}>P4: Low</option>
                  </select>
                  <span className="bg-zinc-950 px-2 py-0.5 rounded text-zinc-400 border border-zinc-800 font-mono">
                    Est: {task.estimated_minutes}m
                  </span>

                  {task.subtasks && task.subtasks.length > 0 && (
                    <span className="bg-zinc-950 px-2 py-0.5 rounded text-zinc-300 border border-zinc-800 font-mono">
                      {task.subtasks.length} subtasks
                    </span>
                  )}
                </div>
              </div>
            ))}

            {candidateTasks.length === 0 && (
              <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
                All candidate tasks removed.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800 bg-zinc-950/80">
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
          >
            Cancel Ingestion
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting || candidateTasks.length === 0}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Resuming LangGraph...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Approve & Save {candidateTasks.length} Tasks</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
