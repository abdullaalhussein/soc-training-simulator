-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRAINER', 'TRAINEE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttemptStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TIMED_OUT', 'RETAKEN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LogType" AS ENUM ('WINDOWS_EVENT', 'SYSMON', 'EDR_ALERT', 'NETWORK_FLOW', 'SIEM_ALERT', 'FIREWALL', 'PROXY', 'DNS', 'EMAIL_GATEWAY', 'AUTH_LOG');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UnlockCondition" AS ENUM ('AFTER_CHECKPOINT', 'AFTER_TIME_DELAY', 'AFTER_PREVIOUS', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CheckpointType" AS ENUM ('TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION', 'RECOMMENDED_ACTION', 'SHORT_ANSWER', 'EVIDENCE_SELECTION', 'INCIDENT_REPORT', 'YARA_RULE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActionType" AS ENUM ('SEARCH_QUERY', 'FILTER_APPLIED', 'LOG_OPENED', 'EVIDENCE_ADDED', 'EVIDENCE_REMOVED', 'TIMELINE_ENTRY_ADDED', 'TIMELINE_ENTRY_REMOVED', 'PROCESS_NODE_ADDED', 'HINT_REQUESTED', 'CHECKPOINT_ANSWERED', 'STAGE_UNLOCKED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRAINEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "category" TEXT NOT NULL,
    "mitreAttackIds" TEXT[],
    "briefing" TEXT NOT NULL,
    "lessonContent" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScenarioStage" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unlockCondition" "UnlockCondition" NOT NULL DEFAULT 'AFTER_PREVIOUS',
    "unlockDelay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScenarioStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SimulatedLog" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "logType" "LogType" NOT NULL,
    "rawLog" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "hostname" TEXT,
    "username" TEXT,
    "processName" TEXT,
    "eventId" TEXT,
    "sourceIp" TEXT,
    "destIp" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "isEvidence" BOOLEAN NOT NULL DEFAULT false,
    "evidenceTag" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SimulatedLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Checkpoint" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "checkpointType" "CheckpointType" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "category" TEXT,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Hint" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pointsPenalty" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Hint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "timeLimit" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Attempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "status" "AttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "retakeOfId" TEXT,
    "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "investigationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hintPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trainerAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvestigationAction" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestigationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainerNote" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isHint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainerNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

CREATE INDEX IF NOT EXISTS "Scenario_difficulty_idx" ON "Scenario"("difficulty");
CREATE INDEX IF NOT EXISTS "Scenario_category_idx" ON "Scenario"("category");

CREATE UNIQUE INDEX IF NOT EXISTS "ScenarioStage_scenarioId_stageNumber_key" ON "ScenarioStage"("scenarioId", "stageNumber");
CREATE INDEX IF NOT EXISTS "ScenarioStage_scenarioId_idx" ON "ScenarioStage"("scenarioId");

CREATE INDEX IF NOT EXISTS "SimulatedLog_stageId_idx" ON "SimulatedLog"("stageId");
CREATE INDEX IF NOT EXISTS "SimulatedLog_logType_idx" ON "SimulatedLog"("logType");
CREATE INDEX IF NOT EXISTS "SimulatedLog_hostname_idx" ON "SimulatedLog"("hostname");
CREATE INDEX IF NOT EXISTS "SimulatedLog_username_idx" ON "SimulatedLog"("username");
CREATE INDEX IF NOT EXISTS "SimulatedLog_processName_idx" ON "SimulatedLog"("processName");
CREATE INDEX IF NOT EXISTS "SimulatedLog_eventId_idx" ON "SimulatedLog"("eventId");
CREATE INDEX IF NOT EXISTS "SimulatedLog_sourceIp_idx" ON "SimulatedLog"("sourceIp");
CREATE INDEX IF NOT EXISTS "SimulatedLog_destIp_idx" ON "SimulatedLog"("destIp");
CREATE INDEX IF NOT EXISTS "SimulatedLog_timestamp_idx" ON "SimulatedLog"("timestamp");
CREATE INDEX IF NOT EXISTS "SimulatedLog_stageId_logType_idx" ON "SimulatedLog"("stageId", "logType");
CREATE INDEX IF NOT EXISTS "SimulatedLog_stageId_timestamp_idx" ON "SimulatedLog"("stageId", "timestamp");
CREATE INDEX IF NOT EXISTS "SimulatedLog_isEvidence_idx" ON "SimulatedLog"("isEvidence");

CREATE INDEX IF NOT EXISTS "Checkpoint_scenarioId_stageNumber_idx" ON "Checkpoint"("scenarioId", "stageNumber");

CREATE INDEX IF NOT EXISTS "Hint_stageId_idx" ON "Hint"("stageId");

CREATE INDEX IF NOT EXISTS "Session_status_idx" ON "Session"("status");
CREATE INDEX IF NOT EXISTS "Session_createdById_idx" ON "Session"("createdById");
CREATE INDEX IF NOT EXISTS "Session_scenarioId_idx" ON "Session"("scenarioId");

CREATE UNIQUE INDEX IF NOT EXISTS "SessionMember_sessionId_userId_key" ON "SessionMember"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "SessionMember_sessionId_idx" ON "SessionMember"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionMember_userId_idx" ON "SessionMember"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Attempt_sessionId_userId_attemptNumber_key" ON "Attempt"("sessionId", "userId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "Attempt_sessionId_userId_idx" ON "Attempt"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "Attempt_sessionId_idx" ON "Attempt"("sessionId");
CREATE INDEX IF NOT EXISTS "Attempt_userId_idx" ON "Attempt"("userId");
CREATE INDEX IF NOT EXISTS "Attempt_status_idx" ON "Attempt"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "Answer_attemptId_checkpointId_key" ON "Answer"("attemptId", "checkpointId");
CREATE INDEX IF NOT EXISTS "Answer_attemptId_idx" ON "Answer"("attemptId");

CREATE INDEX IF NOT EXISTS "InvestigationAction_attemptId_idx" ON "InvestigationAction"("attemptId");
CREATE INDEX IF NOT EXISTS "InvestigationAction_actionType_idx" ON "InvestigationAction"("actionType");
CREATE INDEX IF NOT EXISTS "InvestigationAction_attemptId_actionType_idx" ON "InvestigationAction"("attemptId", "actionType");

CREATE INDEX IF NOT EXISTS "TrainerNote_attemptId_idx" ON "TrainerNote"("attemptId");

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_createdAt_idx" ON "SessionMessage"("sessionId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");

-- AddForeignKey (idempotent via IF NOT EXISTS on constraint name)
DO $$ BEGIN
  ALTER TABLE "ScenarioStage" ADD CONSTRAINT "ScenarioStage_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SimulatedLog" ADD CONSTRAINT "SimulatedLog_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ScenarioStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Hint" ADD CONSTRAINT "Hint_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ScenarioStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_retakeOfId_fkey" FOREIGN KEY ("retakeOfId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Answer" ADD CONSTRAINT "Answer_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InvestigationAction" ADD CONSTRAINT "InvestigationAction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TrainerNote" ADD CONSTRAINT "TrainerNote_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TrainerNote" ADD CONSTRAINT "TrainerNote_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
