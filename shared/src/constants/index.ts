export const SCORE_WEIGHTS = {
  ACCURACY: 35,
  INVESTIGATION: 20,
  EVIDENCE: 20,
  RESPONSE: 15,
  REPORT: 10,
} as const;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const SESSION_EVENTS = {
  PROGRESS_UPDATE: 'progress-update',
  TRAINEE_JOINED: 'trainee-joined',
  TRAINEE_LEFT: 'trainee-left',
  HINT_SENT: 'hint-sent',
  SESSION_PAUSED: 'session-paused',
  SESSION_RESUMED: 'session-resumed',
  SESSION_ENDED: 'session-ended',
  SCORE_ADJUSTED: 'score-adjusted',
  STAGE_UNLOCKED: 'stage-unlocked',
} as const;

export const RATE_LIMITS = {
  LOGS_PER_MINUTE: 100,
  AUTH_PER_MINUTE: 10,
  GENERAL_PER_MINUTE: 60,
} as const;
