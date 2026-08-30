export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type PriorityLevel = 1 | 2 | 3 | 4;
export type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate';

export interface Tag {
  id: number;
  name: string;
}

export interface SubTask {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  eisenhower_quadrant: EisenhowerQuadrant;
  due_date: string | null;
  estimated_minutes: number;
  source_type: string;
  source_context: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  subtasks: SubTask[];
  tags: Tag[];
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: PriorityLevel;
  eisenhower_quadrant?: EisenhowerQuadrant;
  due_date?: string;
  estimated_minutes?: number;
  tags?: string[];
  subtasks?: string[];
}

export interface ExtractedTask {
  title: string;
  description?: string | null;
  priority: PriorityLevel;
  eisenhower_quadrant: EisenhowerQuadrant;
  due_date_iso?: string | null;
  estimated_minutes: number;
  tags: string[];
  subtasks: string[];
  source_context?: string | null;
}

export interface DuplicateDetection {
  extracted_title: string;
  existing_id: number;
  existing_title: string;
  existing_status: string;
  similarity_score: number;
}

export interface IngestResponse {
  thread_id: string;
  status: 'completed' | 'interrupted_review_needed';
  tasks_extracted: ExtractedTask[];
  duplicates_detected: DuplicateDetection[];
  message: string;
}

export interface DayPlanItem {
  task_id: number;
  title: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  priority: number;
  rationale: string;
}

export interface DayPlanResponse {
  summary: string;
  total_planned_minutes: number;
  schedule: DayPlanItem[];
  unplanned_tasks_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tools_called?: Array<{ name: string; args?: Record<string, unknown>; output?: string }>;
  timestamp: string;
}
