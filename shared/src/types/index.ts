export enum Role {
  ADMIN = 'ADMIN',
  TRAINER = 'TRAINER',
  TRAINEE = 'TRAINEE',
}

export enum SessionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum AttemptStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum LogType {
  WINDOWS_EVENT = 'WINDOWS_EVENT',
  SYSMON = 'SYSMON',
  EDR_ALERT = 'EDR_ALERT',
  NETWORK_FLOW = 'NETWORK_FLOW',
  SIEM_ALERT = 'SIEM_ALERT',
  FIREWALL = 'FIREWALL',
  PROXY = 'PROXY',
  DNS = 'DNS',
  EMAIL_GATEWAY = 'EMAIL_GATEWAY',
  AUTH_LOG = 'AUTH_LOG',
}

export enum UnlockCondition {
  AFTER_CHECKPOINT = 'AFTER_CHECKPOINT',
  AFTER_TIME_DELAY = 'AFTER_TIME_DELAY',
  AFTER_PREVIOUS = 'AFTER_PREVIOUS',
  MANUAL = 'MANUAL',
}

export enum CheckpointType {
  TRUE_FALSE = 'TRUE_FALSE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SEVERITY_CLASSIFICATION = 'SEVERITY_CLASSIFICATION',
  RECOMMENDED_ACTION = 'RECOMMENDED_ACTION',
  SHORT_ANSWER = 'SHORT_ANSWER',
  EVIDENCE_SELECTION = 'EVIDENCE_SELECTION',
  INCIDENT_REPORT = 'INCIDENT_REPORT',
}

export enum ActionType {
  SEARCH_QUERY = 'SEARCH_QUERY',
  FILTER_APPLIED = 'FILTER_APPLIED',
  LOG_OPENED = 'LOG_OPENED',
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  EVIDENCE_REMOVED = 'EVIDENCE_REMOVED',
  TIMELINE_ENTRY_ADDED = 'TIMELINE_ENTRY_ADDED',
  TIMELINE_ENTRY_REMOVED = 'TIMELINE_ENTRY_REMOVED',
  PROCESS_NODE_ADDED = 'PROCESS_NODE_ADDED',
  HINT_REQUESTED = 'HINT_REQUESTED',
  CHECKPOINT_ANSWERED = 'CHECKPOINT_ANSWERED',
  STAGE_UNLOCKED = 'STAGE_UNLOCKED',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Difficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface TraineeProgress {
  sessionId: string;
  attemptId: string;
  userId: string;
  userName: string;
  currentStage: number;
  totalStages: number;
  checkpointsCompleted: number;
  totalCheckpoints: number;
  evidenceCount: number;
  searchCount: number;
  lastAction: string;
  currentScore: number;
  elapsedMinutes: number;
  status: AttemptStatus;
}

export interface ScoreBreakdown {
  accuracy: number;
  investigation: number;
  evidence: number;
  response: number;
  report: number;
  hintPenalty: number;
  trainerAdjustment: number;
  total: number;
}

export interface LogFilter {
  logType?: LogType;
  hostname?: string;
  username?: string;
  processName?: string;
  eventId?: string;
  sourceIp?: string;
  destIp?: string;
  timeFrom?: string;
  timeTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
