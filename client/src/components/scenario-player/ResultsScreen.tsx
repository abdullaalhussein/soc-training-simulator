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
  Search,
  Filter,
  FileText,
  GitBranch,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

interface ResultsScreenProps {
  attemptId: string;
  embedded?: boolean;
}

const BASE_SCORE_CATEGORIES = [
  { key: 'accuracyScore', label: 'Accuracy', baseWeight: 35, color: 'bg-blue-500', checkpointBased: true, types: ['TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION'], category: 'accuracy' },
  { key: 'investigationScore', label: 'Investigation', baseWeight: 20, color: 'bg-emerald-500', checkpointBased: false, types: [] as string[], category: '' },
  { key: 'evidenceScore', label: 'Evidence Collection', baseWeight: 20, color: 'bg-violet-500', checkpointBased: false, types: [] as string[], category: '' },
  { key: 'responseScore', label: 'Incident Response', baseWeight: 15, color: 'bg-orange-500', checkpointBased: true, types: ['RECOMMENDED_ACTION'], category: 'response' },
  { key: 'reportScore', label: 'Reporting', baseWeight: 10, color: 'bg-rose-500', checkpointBased: true, types: ['INCIDENT_REPORT'], category: 'report' },
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

  // Determine which checkpoint-based categories exist in this scenario
  const allCheckpoints = (results.answers || []).map((a: any) => a.checkpoint).filter(Boolean);
  const activeCategories = BASE_SCORE_CATEGORIES.map(cat => {
    if (!cat.checkpointBased) return { ...cat, active: true };
    const hasCheckpoints = allCheckpoints.some((cp: any) =>
      cp.category === cat.category || (cat.types as readonly string[]).includes(cp.checkpointType)
    );
    return { ...cat, active: hasCheckpoints };
  });

  // Calculate dynamic weights — redistribute missing category weight proportionally
  const totalActiveWeight = activeCategories.reduce((s, c) => s + (c.active ? c.baseWeight : 0), 0);
  const scale = totalActiveWeight > 0 ? 100 / totalActiveWeight : 1;
  const SCORE_CATEGORIES = activeCategories
    .filter(c => c.active)
    .map(c => ({ key: c.key, label: c.label, max: Math.round(c.baseWeight * scale * 10) / 10, color: c.color }));

  // Compute performance highlight (highest percentage category)
  const bestCategory = SCORE_CATEGORIES.reduce((best, cat) => {
    const score = results[cat.key] ?? 0;
    const pct = cat.max > 0 ? score / cat.max : 0;
    const bestPct = best.max > 0 ? (results[best.key] ?? 0) / best.max : 0;
    return pct > bestPct ? cat : best;
  }, SCORE_CATEGORIES[0]);
  const bestPct = bestCategory?.max > 0
    ? Math.round(((results[bestCategory.key] ?? 0) / bestCategory.max) * 100)
    : 0;

  // Determine scoring category for a checkpoint (mirrors server scoring.service.ts logic)
  const getCategoryInfo = (cp: any): { label: string; color: string } => {
    if (cp?.category === 'accuracy' || ['TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION'].includes(cp?.checkpointType))
      return { label: 'Accuracy', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    if (cp?.category === 'response' || cp?.checkpointType === 'RECOMMENDED_ACTION')
      return { label: 'Incident Response', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
    if (cp?.category === 'report' || cp?.checkpointType === 'INCIDENT_REPORT')
      return { label: 'Reporting', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' };
    if (cp?.checkpointType === 'EVIDENCE_SELECTION')
      return { label: 'Evidence Collection', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' };
    if (cp?.category) return { label: cp.category, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
    return { label: 'Accuracy', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  };

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

  // Compute investigation sub-scores from actions (mirrors server scoring logic)
  const searchActions = (results.actions || []).filter((a: any) => a.actionType === 'SEARCH_QUERY');
  const filterActions = (results.actions || []).filter((a: any) => a.actionType === 'FILTER_APPLIED');
  const logOpenedActions = (results.actions || []).filter((a: any) => a.actionType === 'LOG_OPENED');
  const timelineAddActions = (results.actions || []).filter((a: any) => a.actionType === 'TIMELINE_ENTRY_ADDED');
  const processNodeActions = (results.actions || []).filter((a: any) => a.actionType === 'PROCESS_NODE_ADDED');

  const uniqueSearches = new Set(searchActions.map((s: any) => JSON.stringify(s.details))).size;
  const investigationBreakdown = {
    searchDiversity: { value: Math.min(uniqueSearches, 5), max: 5, label: 'Search Diversity', detail: `${uniqueSearches} unique searches` },
    filterUsage: { value: Math.min(filterActions.length, 5), max: 5, label: 'Filter Usage', detail: `${filterActions.length} filters applied` },
    logDepth: { value: Math.min(logOpenedActions.length, 10), max: 10, label: 'Log Depth', detail: `${logOpenedActions.length} logs opened` },
    building: { value: Math.min(timelineAddActions.length + processNodeActions.length, 5), max: 5, label: 'Timeline & Process Building', detail: `${timelineAddActions.length} timeline + ${processNodeActions.length} process` },
  };

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
      if (correct.referenceRule) return correct.referenceRule;
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

        {/* Investigation Breakdown */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Investigation Breakdown</h2>
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Investigation score is based on your investigative actions during the scenario.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(investigationBreakdown).map((item, i) => {
                const icons = [Search, Filter, FileText, GitBranch];
                const Icon = icons[i];
                const itemPct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
                return (
                  <div key={i} className="bg-muted/50 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-medium">{item.label}</p>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary mt-1 mb-1">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${itemPct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{item.detail} ({item.value}/{item.max})</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stage-by-Stage Review */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Stage-by-Stage Review</h2>
          {sortedStages.map((stageNum) => {
            const stageEvidence = evidenceByStage[stageNum] || [];
            const stageTimeline = timelineByStage[stageNum] || [];

            return (
              <div key={stageNum} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Stage {stageNum}
                </h3>

                {/* Checkpoint answers */}
                {answersByStage[stageNum].map((answer: any) => {
                  const cp = answer.checkpoint;
                  const catInfo = getCategoryInfo(cp);
                  return (
                    <div
                      key={answer.id}
                      className="bg-card border rounded-lg p-4 space-y-3"
                    >
                      {/* Question header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{cp?.question}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${catInfo.color}`}>
                              {catInfo.label}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {(cp?.checkpointType || '').replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
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
                      <div className={`grid grid-cols-1 ${cp?.checkpointType === 'YARA_RULE' ? '' : 'md:grid-cols-2'} gap-3`}>
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                          {cp?.checkpointType === 'YARA_RULE' ? (
                            <pre className="font-mono text-sm whitespace-pre-wrap bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto">{formatAnswer(answer)}</pre>
                          ) : (
                            <p className="text-sm">{formatAnswer(answer)}</p>
                          )}
                        </div>
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Correct Answer</p>
                          {cp?.checkpointType === 'YARA_RULE' ? (
                            <pre className="font-mono text-sm whitespace-pre-wrap bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto">{formatCorrectAnswer(cp)}</pre>
                          ) : (
                            <p className="text-sm">{formatCorrectAnswer(cp)}</p>
                          )}
                        </div>
                      </div>

                      {/* AI Feedback */}
                      {answer.feedback && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <p className="text-xs font-medium text-purple-800 dark:text-purple-400">AI Feedback</p>
                          </div>
                          <MarkdownRenderer content={answer.feedback} className="text-sm text-purple-800 dark:text-purple-300" />
                        </div>
                      )}

                      {/* Explanation */}
                      {cp?.explanation && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Explanation</p>
                          </div>
                          <MarkdownRenderer content={cp.explanation} className="text-sm text-blue-800 dark:text-blue-300" />
                        </div>
                      )}
                    </div>
                  );
                })}

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
