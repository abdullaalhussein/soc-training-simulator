import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';

export class PdfReportService {
  static async generateAttemptReport(attemptId: string): Promise<Buffer> {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { name: true, email: true } },
        session: { include: { scenario: true } },
        answers: { include: { checkpoint: true }, orderBy: { answeredAt: 'asc' } },
        actions: { orderBy: { createdAt: 'asc' } },
        notes: { include: { trainer: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!attempt) throw new Error('Attempt not found');

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

      const scores = [
        { label: 'Accuracy', score: attempt.accuracyScore, max: 35 },
        { label: 'Investigation', score: attempt.investigationScore, max: 20 },
        { label: 'Evidence', score: attempt.evidenceScore, max: 20 },
        { label: 'Response', score: attempt.responseScore, max: 15 },
        { label: 'Report', score: attempt.reportScore, max: 10 },
      ];

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
        doc.fontSize(11).font('Helvetica-Bold').text(`Q: ${cp.question}`);
        doc.fontSize(10).font('Helvetica');

        const answerText = typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer);
        doc.text(`Answer: ${answerText}`);

        if (answer.isCorrect) {
          doc.fillColor('#16A34A').text(`Correct - ${answer.pointsAwarded}/${cp.points} pts`);
        } else {
          doc.fillColor('#DC2626').text(`Incorrect - ${answer.pointsAwarded}/${cp.points} pts`);
        }
        doc.fillColor('#000000');

        if (cp.explanation) {
          doc.fontSize(9).fillColor('#6B7280').text(`Explanation: ${cp.explanation}`);
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
