import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const attemptId = 'cmlrtgp490019o2012bab1kwe';

// Check all investigation actions (evidence + timeline)
const actions = await prisma.investigationAction.findMany({
  where: { attemptId },
  orderBy: { createdAt: 'asc' },
});

console.log(`=== Norah's Investigation Actions (${actions.length} total) ===\n`);

const byType = {};
actions.forEach(a => {
  byType[a.actionType] = (byType[a.actionType] || 0) + 1;
});
console.log('Actions by type:', JSON.stringify(byType, null, 2));

console.log('\n--- Evidence Actions ---');
const evidenceActions = actions.filter(a => a.actionType === 'EVIDENCE_ADDED' || a.actionType === 'EVIDENCE_REMOVED');
evidenceActions.forEach(a => {
  console.log(`  ${a.actionType} at ${a.createdAt}: ${JSON.stringify(a.details)}`);
});

console.log('\n--- Timeline Actions ---');
const timelineActions = actions.filter(a => a.actionType === 'TIMELINE_ENTRY_ADDED' || a.actionType === 'TIMELINE_ENTRY_REMOVED');
timelineActions.forEach(a => {
  console.log(`  ${a.actionType} at ${a.createdAt}: ${JSON.stringify(a.details)}`);
});

// Check answers
const answers = await prisma.answer.findMany({
  where: { attemptId },
  include: { checkpoint: { select: { question: true, stageNumber: true } } },
});
console.log(`\n--- Answers (${answers.length}) ---`);
answers.forEach(a => {
  console.log(`  Stage ${a.checkpoint.stageNumber}: ${a.isCorrect ? 'CORRECT' : 'WRONG'} (${a.pointsAwarded}pts) — ${a.checkpoint.question.substring(0, 70)}...`);
});

await prisma.$disconnect();
