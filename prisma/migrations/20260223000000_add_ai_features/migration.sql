-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "feedback" TEXT;

-- CreateTable
CREATE TABLE "AiAssistantMessage" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAssistantMessage_attemptId_createdAt_idx" ON "AiAssistantMessage"("attemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAssistantMessage" ADD CONSTRAINT "AiAssistantMessage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
