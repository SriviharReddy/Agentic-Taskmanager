import { Task, TaskCreateInput, IngestResponse, ExtractedTask, DayPlanResponse, Tag } from '../types';

const API_BASE = '/api/v1';

export const api = {
  // Tasks CRUD
  async fetchTasks(params?: {
    status?: string;
    priority?: number;
    eisenhower_quadrant?: string;
    tag?: string;
    search?: string;
  }): Promise<{ total: number; tasks: Task[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority.toString());
    if (params?.eisenhower_quadrant) query.append('eisenhower_quadrant', params.eisenhower_quadrant);
    if (params?.tag) query.append('tag', params.tag);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/tasks?${query.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.statusText}`);
    return res.json();
  },

  async createTask(data: TaskCreateInput): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
    return res.json();
  },

  async updateTask(id: number, data: Partial<TaskCreateInput>): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update task: ${res.statusText}`);
    return res.json();
  },

  async deleteTask(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete task: ${res.statusText}`);
  },

  // Subtasks
  async addSubtask(taskId: number, title: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, is_completed: false }),
    });
    if (!res.ok) throw new Error(`Failed to add subtask: ${res.statusText}`);
  },

  async updateSubtask(taskId: number, subtaskId: number, is_completed?: boolean, title?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed, title }),
    });
    if (!res.ok) throw new Error(`Failed to update subtask: ${res.statusText}`);
  },

  async deleteSubtask(taskId: number, subtaskId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete subtask: ${res.statusText}`);
  },

  async autoBreakdownTask(taskId: number, numSteps: number = 4): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/breakdown?num_steps=${numSteps}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to break down task: ${res.statusText}`);
    return res.json();
  },

  async fetchTags(): Promise<Tag[]> {
    const res = await fetch(`${API_BASE}/tasks/tags/all`);
    if (!res.ok) return [];
    return res.json();
  },

  // Ingestion & HITL Interrupts
  async ingestContent(data: {
    text?: string;
    url?: string;
    image_base64?: string;
    audio_base64?: string;
    timezone?: string;
  }): Promise<IngestResponse> {
    const res = await fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Ingestion failed');
    }
    return res.json();
  },

  async resumeIngestInterrupt(data: {
    thread_id: string;
    approved: boolean;
    tasks?: ExtractedTask[];
  }): Promise<IngestResponse> {
    const res = await fetch(`${API_BASE}/ingest/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to resume ingestion: ${res.statusText}`);
    return res.json();
  },

  // Day Planner
  async generateDaySchedule(data: {
    available_hours: number;
    focus_mode: string;
  }): Promise<DayPlanResponse> {
    const res = await fetch(`${API_BASE}/planner/day-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        current_time_iso: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`Failed to generate day schedule: ${res.statusText}`);
    return res.json();
  },

  // Copilot Streaming Chat
  async streamChat(
    message: string,
    threadId: string | null,
    callbacks: {
      onInit?: (threadId: string) => void;
      onToken: (token: string) => void;
      onToolStart: (name: string, args?: Record<string, unknown>) => void;
      onToolEnd: (name: string, output: string) => void;
      onDone: (threadId: string) => void;
      onError: (error: string) => void;
    }
  ): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          thread_id: threadId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat stream error: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace('data: ', '');
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'init' && callbacks.onInit) {
                callbacks.onInit(parsed.thread_id);
              } else if (parsed.type === 'token') {
                callbacks.onToken(parsed.content);
              } else if (parsed.type === 'tool_start') {
                callbacks.onToolStart(parsed.name, parsed.args);
              } else if (parsed.type === 'tool_end') {
                callbacks.onToolEnd(parsed.name, parsed.output);
              } else if (parsed.type === 'done') {
                callbacks.onDone(parsed.thread_id);
              } else if (parsed.type === 'error') {
                callbacks.onError(parsed.message);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown streaming error';
      callbacks.onError(msg);
    }
  },
};
