import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all active attempts with their users and answers
const attempts = await prisma.attempt.findMany({
  where: { status: 'IN_PROGRESS' },
  include: {
    user: { select: { name: true, email: true } },
    answers: { select: { checkpointId: true } },
    session: {
      include: {
        scenario: {
          include: {
            checkpoints: { orderBy: [{ stageNumber: 'asc' }, { sortOrder: 'asc' }] },
          },
        },
      },
    },
  },
});

console.log(`=== All Active Trainees (${attempts.length} attempts) ===\n`);

for (const attempt of attempts) {
  const user = attempt.user;
  const scenario = attempt.session.scenario;
  const allCheckpoints = scenario.checkpoints;
  const answeredIds = new Set(attempt.answers.map(a => a.checkpointId));

  const stageCheckpoints = allCheckpoints.filter(c => c.stageNumber === attempt.currentStage);
  const unanswered = stageCheckpoints.filter(c => !answeredIds.has(c.id));

  const byStage = {};
  allCheckpoints.forEach(c => {
    byStage[c.stageNumber] = (byStage[c.stageNumber] || 0) + 1;
  });

  console.log(`${user.name} (${user.email})`);
  console.log(`  Scenario: ${scenario.name}`);
  console.log(`  Stage: ${attempt.currentStage} | Answers: ${attempt.answers.length} | Score: ${attempt.totalScore}`);
  console.log(`  Checkpoints for stage ${attempt.currentStage}: ${stageCheckpoints.length} | Unanswered: ${unanswered.length}`);
  if (unanswered.length > 0) {
    unanswered.forEach(c => console.log(`    - [${c.checkpointType}] ${c.question.substring(0, 80)}...`));
  } else if (stageCheckpoints.length === 0) {
    console.log(`    >>> NO CHECKPOINTS EXIST for stage ${attempt.currentStage}!`);
    console.log(`    Scenario checkpoints by stage: ${JSON.stringify(byStage)}`);
  } else {
    console.log(`    All checkpoints answered for this stage.`);
  }
  console.log('');
}

// Also check completed attempts
const completed = await prisma.attempt.findMany({
  where: { status: 'COMPLETED' },
  include: {
    user: { select: { name: true, email: true } },
    session: { include: { scenario: { select: { name: true } } } },
  },
});

if (completed.length > 0) {
  console.log(`=== Completed Attempts (${completed.length}) ===\n`);
  for (const a of completed) {
    console.log(`${a.user.name} (${a.user.email}) — ${a.session.scenario.name} — Score: ${a.totalScore}`);
  }
}

await prisma.$disconnect();
