import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';

// Strip markdown syntax for plain-text PDF output
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Format checkpoint answer for display
function formatAnswer(answer: any, checkpointType: string): string {
  if (answer === null || answer === undefined) return '—';
  if (typeof answer === 'boolean') return answer ? 'True' : 'False';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') {
    const parts: string[] = [];
    if (answer.summary) parts.push(answer.summary);
    if (answer.recommendations?.length) parts.push(`Recommendations: ${answer.recommendations.join('; ')}`);
    return parts.join(' | ') || JSON.stringify(answer);
  }
  return String(answer);
}

// Format correct answer for display
function formatCorrectAnswer(checkpoint: any): string {
  const correct = checkpoint?.correctAnswer;
  if (correct === null || correct === undefined) return '—';
  if (typeof correct === 'boolean') return correct ? 'True' : 'False';
  if (Array.isArray(correct)) return correct.join(', ');
  if (typeof correct === 'object') {
    if (correct.referenceRule) return correct.referenceRule;
    if (correct.keywords) return `Keywords: ${correct.keywords.join(', ')}`;
    const parts: string[] = [];
    if (correct.summary) parts.push(correct.summary);
    if (correct.minRecommendations) parts.push(`Min recommendations: ${correct.minRecommendations}`);
    return parts.join('; ') || JSON.stringify(correct);
  }
  return String(correct);
}

export class PdfReportService {
  static async generateAttemptReport(attemptId: string): Promise<Buffer> {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { name: true, email: true } },
        session: {
          include: {
            scenario: {
              include: { checkpoints: true },
            },
          },
        },
        answers: { include: { checkpoint: true }, orderBy: { answeredAt: 'asc' } },
        actions: { orderBy: { createdAt: 'asc' } },
        notes: { include: { trainer: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!attempt) throw new Error('Attempt not found');

    // Calculate dynamic score weights (same logic as scoring.service.ts)
    const allCheckpoints = attempt.session.scenario.checkpoints;
    const hasAccuracy = allCheckpoints.some(c =>
      c.category === 'accuracy' || ['TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION'].includes(c.checkpointType)
    );
    const hasResponse = allCheckpoints.some(c => c.category === 'response' || c.checkpointType === 'RECOMMENDED_ACTION');
    const hasReport = allCheckpoints.some(c => c.category === 'report' || c.checkpointType === 'INCIDENT_REPORT');

    const baseWeights = {
      accuracy: hasAccuracy ? 35 : 0,
      investigation: 20,
      evidence: 20,
      response: hasResponse ? 15 : 0,
      report: hasReport ? 10 : 0,
    };
    const totalActiveWeight = Object.values(baseWeights).reduce((a, b) => a + b, 0);
    const scale = totalActiveWeight > 0 ? 100 / totalActiveWeight : 1;

    const scores = [
      { label: 'Accuracy', score: attempt.accuracyScore, max: Math.round(baseWeights.accuracy * scale * 10) / 10 },
      { label: 'Investigation', score: attempt.investigationScore, max: Math.round(baseWeights.investigation * scale * 10) / 10 },
      { label: 'Evidence', score: attempt.evidenceScore, max: Math.round(baseWeights.evidence * scale * 10) / 10 },
      { label: 'Response', score: attempt.responseScore, max: Math.round(baseWeights.response * scale * 10) / 10 },
      { label: 'Report', score: attempt.reportScore, max: Math.round(baseWeights.report * scale * 10) / 10 },
    ].filter(s => s.max > 0);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Cover
      doc.fontSize(28).font('Helvetica-Bold').text('SOC Training Report', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(14).font('Helvetica').text(`Trainee: ${attempt.user.name}`, { align: 'center' });
      doc.text(`Email: ${attempt.user.email}`, { align: 'center' });
      doc.moveDown();
      doc.text(`Scenario: ${attempt.session.scenario.name}`, { align: 'center' });
      doc.text(`Difficulty: ${attempt.session.scenario.difficulty}`, { align: 'center' });
      doc.text(`Session: ${attempt.session.name}`, { align: 'center' });
      doc.moveDown();
      doc.text(`Date: ${attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : 'In Progress'}`, { align: 'center' });
      doc.moveDown(2);

      // Overall score
      doc.fontSize(48).font('Helvetica-Bold').text(`${attempt.totalScore}`, { align: 'center' });
      doc.fontSize(14).font('Helvetica').text('/ 100 points', { align: 'center' });

      // Page 2: Score Breakdown
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold').text('Score Breakdown');
      doc.moveDown();

      const barStartX = 180;
      const barMaxWidth = 300;
      let barY = doc.y;

      for (const s of scores) {
        doc.fontSize(12).font('Helvetica').text(`${s.label}:`, 50, barY);
        doc.fontSize(12).text(`${s.score}/${s.max}`, 130, barY);

        // Background bar
        doc.rect(barStartX, barY, barMaxWidth, 14).fillColor('#E2E8F0').fill();
        // Score bar
        const width = s.max > 0 ? (s.score / s.max) * barMaxWidth : 0;
        doc.rect(barStartX, barY, width, 14).fillColor('#3B82F6').fill();
        doc.fillColor('#000000');

        barY += 30;
      }

      doc.y = barY + 10;
      if (attempt.hintPenalty > 0) {
        doc.fontSize(12).font('Helvetica').fillColor('#DC2626')
          .text(`Hint Penalty: -${attempt.hintPenalty} points (${attempt.hintsUsed} hints used)`);
        doc.fillColor('#000000');
      }
      if (attempt.trainerAdjustment !== 0) {
        doc.fontSize(12).text(`Trainer Adjustment: ${attempt.trainerAdjustment > 0 ? '+' : ''}${attempt.trainerAdjustment} points`);
      }

      // Page 3: Checkpoint Answers
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold').text('Checkpoint Answers');
      doc.moveDown();

      for (const answer of attempt.answers) {
        const cp = answer.checkpoint;
        const isYara = cp.checkpointType === 'YARA_RULE';

        // Question
        doc.fontSize(11).font('Helvetica-Bold').text(`Q: ${stripMarkdown(cp.question)}`);
        doc.fontSize(10).font('Helvetica');

        // Trainee's answer
        const answerText = formatAnswer(answer.answer, cp.checkpointType);
        if (isYara) {
          doc.text('Your Rule:');
          doc.font('Courier').fontSize(8).text(answerText);
          doc.font('Helvetica').fontSize(10);
        } else {
          doc.text(`Answer: ${answerText}`);
        }

        // Result
        if (answer.isCorrect) {
          doc.fillColor('#16A34A').text(`Correct — ${answer.pointsAwarded}/${cp.points} pts`);
        } else {
          doc.fillColor('#DC2626').text(`Incorrect — ${answer.pointsAwarded}/${cp.points} pts`);
        }
        doc.fillColor('#000000');

        // Correct answer (for wrong answers)
        if (!answer.isCorrect) {
          const correctText = formatCorrectAnswer(cp);
          if (correctText !== '—') {
            if (isYara) {
              doc.fontSize(9).fillColor('#2563EB').text('Reference Rule:');
              doc.font('Courier').fontSize(8).text(correctText);
              doc.font('Helvetica');
            } else {
              doc.fontSize(9).fillColor('#2563EB').text(`Correct Answer: ${correctText}`);
            }
            doc.fillColor('#000000');
          }
        }

        // AI Feedback
        if (answer.feedback) {
          doc.fontSize(9).fillColor('#7C3AED').text(`AI Feedback: ${stripMarkdown(String(answer.feedback))}`);
          doc.fillColor('#000000');
        }

        // Explanation
        if (cp.explanation) {
          doc.fontSize(9).fillColor('#6B7280').text(`Explanation: ${stripMarkdown(cp.explanation)}`);
          doc.fillColor('#000000');
        }

        doc.moveDown(0.5);

        // Check if we need a new page
        if (doc.y > 700) doc.addPage();
      }

      // Page 4: Investigation Summary
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold').text('Investigation Summary');
      doc.moveDown();

      const actionCounts: Record<string, number> = {};
      for (const action of attempt.actions) {
        actionCounts[action.actionType] = (actionCounts[action.actionType] || 0) + 1;
      }

      doc.fontSize(12).font('Helvetica');
      doc.text(`Total Actions: ${attempt.actions.length}`);
      doc.moveDown(0.5);

      for (const [type, count] of Object.entries(actionCounts)) {
        doc.text(`  ${type.replace(/_/g, ' ')}: ${count}`);
      }

      doc.moveDown();
      const duration = attempt.startedAt && attempt.completedAt
        ? Math.round((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)
        : 0;
      doc.text(`Duration: ${duration} minutes`);

      // Trainer Notes
      if (attempt.notes.length > 0) {
        doc.addPage();
        doc.fontSize(20).font('Helvetica-Bold').text('Trainer Notes & Recommendations');
        doc.moveDown();

        for (const note of attempt.notes) {
          doc.fontSize(11).font('Helvetica-Bold').text(`${note.trainer.name}:`);
          doc.fontSize(10).font('Helvetica').text(note.content);
          doc.fontSize(9).fillColor('#6B7280').text(new Date(note.createdAt).toLocaleString());
          doc.fillColor('#000000').moveDown(0.5);
        }
      }

      // Footer
      doc.fontSize(8).fillColor('#9CA3AF')
        .text('Generated by SOC Training Simulator', 50, doc.page.height - 50, { align: 'center' });

      doc.end();
    });
  }
}
