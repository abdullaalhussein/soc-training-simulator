'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle,
  XCircle,
  Trophy,
  Clock,
  Sparkles,
  MousePointerClick,
  Lightbulb,
  ArrowLeft,
  Info,
  Bookmark,
  Clock as ClockIcon,
} from 'lucide-react';

interface ResultsScreenProps {
  attemptId: string;
  embedded?: boolean;
}

const SCORE_CATEGORIES = [
  { key: 'accuracyScore', label: 'Accuracy', max: 35, color: 'bg-blue-500' },
  { key: 'investigationScore', label: 'Investigation', max: 20, color: 'bg-emerald-500' },
  { key: 'evidenceScore', label: 'Evidence Collection', max: 20, color: 'bg-violet-500' },
  { key: 'responseScore', label: 'Incident Response', max: 15, color: 'bg-orange-500' },
  { key: 'reportScore', label: 'Reporting', max: 10, color: 'bg-rose-500' },
] as const;

export function ResultsScreen({ attemptId, embedded }: ResultsScreenProps) {
  const { data: results, isLoading } = useQuery({
    queryKey: ['attempt-results', attemptId],
    queryFn: async () => {
      const { data } = await api.get(`/attempts/${attemptId}/results`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} bg-background p-4 md:p-8`}>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} bg-background flex items-center justify-center text-muted-foreground`}>
        Results not found
      </div>
    );
  }

  // Compute performance highlight (highest percentage category)
  const bestCategory = SCORE_CATEGORIES.reduce((best, cat) => {
    const score = results[cat.key] ?? 0;
    const pct = cat.max > 0 ? score / cat.max : 0;
    const bestPct = best.max > 0 ? (results[best.key] ?? 0) / best.max : 0;
    return pct > bestPct ? cat : best;
  }, SCORE_CATEGORIES[0]);
  const bestPct = bestCategory.max > 0
    ? Math.round(((results[bestCategory.key] ?? 0) / bestCategory.max) * 100)
    : 0;

  // Group answers by stage number
  const answersByStage: Record<number, any[]> = {};
  for (const answer of results.answers || []) {
    const stageNum = answer.checkpoint?.stageNumber ?? 0;
    if (!answersByStage[stageNum]) answersByStage[stageNum] = [];
    answersByStage[stageNum].push(answer);
  }
  const sortedStages = Object.keys(answersByStage)
    .map(Number)
    .sort((a, b) => a - b);

  // Compute stats
  const totalActions = results.actions?.length ?? 0;
  const elapsedMs = results.startedAt && results.completedAt
    ? new Date(results.completedAt).getTime() - new Date(results.startedAt).getTime()
    : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainMinutes = elapsedMinutes % 60;

  // Extract collected evidence and timeline from actions, grouped by stage.
  // Walk chronologically: track add/remove state per logId so re-adds work correctly.
  type EvidenceItem = { summary: string; time: string; stage: number };
  type TimelineItem = { timestamp: string; summary: string; time: string; stage: number };
  const evidenceMap = new Map<string, EvidenceItem>(); // keyed by logId or summary
  const timelineMap = new Map<string, TimelineItem>(); // keyed by logId or summary
  let currentActionStage = 1;

  for (const action of results.actions || []) {
    if (action.actionType === 'STAGE_UNLOCKED' && action.details?.newStage) {
      currentActionStage = action.details.newStage;
    }
    if (action.actionType === 'EVIDENCE_ADDED' && action.details?.summary) {
      const key = action.details.logId || action.details.summary;
      evidenceMap.set(key, {
        summary: action.details.summary,
        time: new Date(action.createdAt).toLocaleTimeString(),
        stage: currentActionStage,
      });
    }
    if (action.actionType === 'EVIDENCE_REMOVED' && action.details?.logId) {
      evidenceMap.delete(action.details.logId);
    }
    if (action.actionType === 'TIMELINE_ENTRY_ADDED' && action.details?.summary) {
      const key = action.details.logId || action.details.summary;
      timelineMap.set(key, {
        timestamp: action.details.timestamp || '',
        summary: action.details.summary,
        time: new Date(action.createdAt).toLocaleTimeString(),
        stage: currentActionStage,
      });
    }
    if (action.actionType === 'TIMELINE_ENTRY_REMOVED') {
      const entryId = action.details?.entryId;
      const logId = action.details?.logId;
      if (logId) timelineMap.delete(logId);
      else if (entryId) timelineMap.delete(entryId);
    }
  }

  // Group surviving items by stage
  const evidenceByStage: Record<number, EvidenceItem[]> = {};
  for (const ev of evidenceMap.values()) {
    if (!evidenceByStage[ev.stage]) evidenceByStage[ev.stage] = [];
    evidenceByStage[ev.stage].push(ev);
  }
  const timelineByStage: Record<number, TimelineItem[]> = {};
  for (const entry of timelineMap.values()) {
    if (!timelineByStage[entry.stage]) timelineByStage[entry.stage] = [];
    timelineByStage[entry.stage].push(entry);
  }

  // Extract correct evidence per stage from EVIDENCE_SELECTION checkpoints
  const correctEvidenceByStage: Record<number, { question: string; correctAnswer: string[] }[]> = {};
  for (const answer of results.answers || []) {
    const cp = answer.checkpoint;
    if (cp?.checkpointType === 'EVIDENCE_SELECTION' && Array.isArray(cp.correctAnswer)) {
      const stage = cp.stageNumber ?? 0;
      if (!correctEvidenceByStage[stage]) correctEvidenceByStage[stage] = [];
      correctEvidenceByStage[stage].push({
        question: cp.question,
        correctAnswer: cp.correctAnswer,
      });
    }
  }

  const formatAnswer = (answer: any) => {
    const val = answer.answer;
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'True' : 'False';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      const parts: string[] = [];
      if (val.summary) parts.push(val.summary);
      if (val.recommendations?.length) parts.push(`Recommendations: ${val.recommendations.join('; ')}`);
      return parts.join(' | ') || JSON.stringify(val);
    }
    return String(val);
  };

  const formatCorrectAnswer = (checkpoint: any) => {
    const correct = checkpoint?.correctAnswer;
    if (correct === null || correct === undefined) return '—';
    if (typeof correct === 'boolean') return correct ? 'True' : 'False';
    if (Array.isArray(correct)) return correct.join(', ');
    if (typeof correct === 'object') {
      if (correct.keywords) return `Keywords: ${correct.keywords.join(', ')}`;
      const parts: string[] = [];
      if (correct.summary) parts.push(correct.summary);
      if (correct.keywords) parts.push(`Keywords: ${correct.keywords.join(', ')}`);
      if (correct.minRecommendations) parts.push(`Min recommendations: ${correct.minRecommendations}`);
      return parts.join('; ') || JSON.stringify(correct);
    }
    return String(correct);
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-background ${embedded ? 'p-2 md:p-4' : 'p-4 md:p-8'}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Investigation Complete</h1>
          <p className="text-muted-foreground">
            {results.session?.scenario?.name}
          </p>
          <div className="inline-block bg-card border-2 border-primary/20 rounded-xl px-8 py-4">
            <p className="text-5xl font-bold text-primary">{results.totalScore}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Score</p>
          </div>
        </div>

        {/* Performance Highlight */}
        {bestPct > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="font-semibold text-amber-900 dark:text-amber-300">Strongest Area</p>
            </div>
            <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
              {bestCategory.label}: {results[bestCategory.key]}/{bestCategory.max}
              <span className="text-sm font-normal ml-2 text-amber-600 dark:text-amber-400">
                ({bestPct}%)
              </span>
            </p>
          </div>
        )}

        {/* Score Breakdown */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Score Breakdown</h2>
          <div className="grid gap-3">
            {SCORE_CATEGORIES.map((cat) => {
              const score = results[cat.key] ?? 0;
              const pct = cat.max > 0 ? Math.round((score / cat.max) * 100) : 0;
              return (
                <div key={cat.key} className="bg-card border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span className="text-sm font-bold">{score}/{cat.max}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${cat.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {results.hintPenalty > 0 && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              Hint Penalty: -{results.hintPenalty} points ({results.hintsUsed} hints used)
            </p>
          )}
          {results.trainerAdjustment !== 0 && (
            <p className="text-sm text-muted-foreground">
              Trainer Adjustment: {results.trainerAdjustment > 0 ? '+' : ''}{results.trainerAdjustment} points
            </p>
          )}
        </div>

        {/* Per-Stage Review */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Stage-by-Stage Review</h2>
          {sortedStages.map((stageNum) => {
            const stageEvidence = evidenceByStage[stageNum] || [];
            const stageTimeline = timelineByStage[stageNum] || [];
            const stageCorrectEvidence = correctEvidenceByStage[stageNum] || [];

            return (
              <div key={stageNum} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Stage {stageNum}
                </h3>

                {/* Checkpoint answers */}
                {answersByStage[stageNum].map((answer: any) => {
                  const cp = answer.checkpoint;
                  return (
                    <div
                      key={answer.id}
                      className="bg-card border rounded-lg p-4 space-y-3"
                    >
                      {/* Question header */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium flex-1">{cp?.question}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {answer.isCorrect ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                              <CheckCircle className="h-3 w-3 mr-1" /> Correct
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">
                              <XCircle className="h-3 w-3 mr-1" /> Incorrect
                            </Badge>
                          )}
                          <Badge variant="outline">{answer.pointsAwarded}/{cp?.points} pts</Badge>
                        </div>
                      </div>

                      {/* Answers comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                          <p className="text-sm">{formatAnswer(answer)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Correct Answer</p>
                          <p className="text-sm">{formatCorrectAnswer(cp)}</p>
                        </div>
                      </div>

                      {/* AI Feedback */}
                      {answer.feedback && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <p className="text-xs font-medium text-purple-800 dark:text-purple-400">AI Feedback</p>
                          </div>
                          <p className="text-sm text-purple-800 dark:text-purple-300">{answer.feedback}</p>
                        </div>
                      )}

                      {/* Explanation */}
                      {cp?.explanation && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Explanation</p>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-300">{cp.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Correct evidence for this stage (from EVIDENCE_SELECTION checkpoints) */}
                {stageCorrectEvidence.map((ec, i) => (
                  <div key={`correct-ev-${i}`} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Required Evidence</p>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2">{ec.question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ec.correctAnswer.map((item, j) => (
                        <Badge key={j} variant="outline" className="border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Collected evidence for this stage */}
                {stageEvidence.length > 0 && (
                  <div className="bg-card border rounded-lg p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Bookmark className="h-3.5 w-3.5" /> Collected Evidence ({stageEvidence.length})
                    </p>
                    <div className="space-y-1.5">
                      {stageEvidence.map((ev, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">{ev.time}</span>
                          <p>{ev.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline entries for this stage */}
                {stageTimeline.length > 0 && (
                  <div className="bg-card border rounded-lg p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5" /> Timeline Entries ({stageTimeline.length})
                    </p>
                    <div className="space-y-1.5">
                      {stageTimeline.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          {entry.timestamp && (
                            <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">{entry.timestamp}</span>
                          )}
                          <p>{entry.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Investigation Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">
                  {elapsedHours > 0 ? `${elapsedHours}h ${remainMinutes}m` : `${elapsedMinutes}m`}
                </p>
                <p className="text-xs text-muted-foreground">Time Spent</p>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <MousePointerClick className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{totalActions}</p>
                <p className="text-xs text-muted-foreground">Total Actions</p>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{results.hintsUsed}</p>
                <p className="text-xs text-muted-foreground">Hints Used</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trainer Notes */}
        {results.notes?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Trainer Notes</h2>
            {results.notes.map((n: any) => (
              <div key={n.id} className="bg-muted p-4 rounded-lg text-sm">
                <p className="font-medium">{n.trainer?.name}</p>
                <p className="mt-1">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Back to Dashboard */}
        {!embedded && (
          <div className="text-center pt-4 pb-8">
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
