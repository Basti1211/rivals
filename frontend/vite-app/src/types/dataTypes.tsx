export type LoadDataResponse = {
  loadedTasks: number;
  loadedUsers: number;
  loadedLogs: number;
  loadedAnswers: number;
  totalTasks: number;
  totalUsers: number;
  totalLogs: number;
  totalAnswers: number;
  sourceFiles: SourceFileRow[];
  errorMessage: string | null;
};

export type SourceFileRow = {
  id: number;
  filename: string;
};

export type ValidJsonFile = {
  file: File;
  data: unknown;
}

export type InteractionHierarchyNode = {
  Name: string;
  Visualize: boolean;
  Cancelled?: boolean;
  Children: InteractionHierarchyNode[];
};

export type TaskRow = {
  task_id: string;
  name: string;
  dataset: string;
  taskGroup: string;
  finished_after_correct_answer: boolean;
  hint_video: string | null;
  hint_video_start_time: number | null;
  hint_video_end_time: number | null;
  hint_text: string | null;
  target_text: string | null;
  target_video: string | null;
  target_video_start_time: number | null;
  target_video_end_time: number | null;
  started: number | null;
  ended: number | null;
  from_file?: number | null;
};

export type TaskList = {
  tasks: TaskRow[];
};

export type SubmissionRow = {
  task_id: string;
  user: string;
  timestamp: number;
  status: -1 | 0 | 1;
  answer_text: string | null;
  answer_video: string | null;
  answer_video_start_time: number | null;
  answer_video_end_time: number | null;
  from_file?: number | null;
  selected?: boolean;
};

export type SubmissionList = {
  submissions: SubmissionRow[];
};

export type InteractionLogRow = {
  timestamp: number;
  action: string;
  frameRank?: number | null;
  videoRank?: number | null;
  metadata?: unknown;
  from_file?: number | null;
  selected?: boolean;
};

export type FetchInteractionLogRow = InteractionLogRow & {
  abstract_type: string;
  task_is_active: boolean;
  cancelled: boolean;
};

export type InteractionTaskUser = {
  user: string;
  task: string;
  interactions: FetchInteractionLogRow[];
};

export type InteractionRequestRow = {
  user: string;
  task: string;
  hierarchy: InteractionHierarchyNode[];
};

export type InteractionRequest = {
  interactions: InteractionRequestRow[];
};

export type UserRow = {
  user: string;
  system: string;
  hierarchy: InteractionHierarchyNode[];
  from_file?: number | null;
};

export type UserList = {
  users: UserRow[];
};

export type FetchUsersAndTasks = {
  tasks: TaskList;
  users: UserList;
};

export type FetchInteractionDataResponse = {
  tasks: TaskList;
  submissions: SubmissionList;
  interactions: InteractionTaskUser[];
  users: UserList;
};
