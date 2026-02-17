'use client';

import { useParams, useRouter } from 'next/navigation';
import { useScenario } from '@/hooks/useScenarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MitreAttackBadge } from '@/components/MitreAttackBadge';
import {
  ArrowLeft, Layers, CheckSquare, Lightbulb, FileText,
  Clock, AlertTriangle, CheckCircle2, HelpCircle,
} from 'lucide-react';

const difficultyColors: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-800',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800',
  ADVANCED: 'bg-red-100 text-red-800',
};

const checkpointTypeLabels: Record<string, string> = {
  TRUE_FALSE: 'True / False',
  MULTIPLE_CHOICE: 'Multiple Choice',
  SEVERITY_CLASSIFICATION: 'Severity Classification',
  RECOMMENDED_ACTION: 'Recommended Action',
  SHORT_ANSWER: 'Short Answer',
  EVIDENCE_SELECTION: 'Evidence Selection',
  INCIDENT_REPORT: 'Incident Report',
};

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: scenario, isLoading } = useScenario(params.id as string);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Scenario not found.
      </div>
    );
  }

  // Group checkpoints by stage number
  const checkpointsByStage: Record<number, any[]> = {};
  scenario.checkpoints?.forEach((cp: any) => {
    if (!checkpointsByStage[cp.stageNumber]) checkpointsByStage[cp.stageNumber] = [];
    checkpointsByStage[cp.stageNumber].push(cp);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/scenarios')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {/* Scenario Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={difficultyColors[scenario.difficulty]}>{scenario.difficulty}</Badge>
            <Badge variant={scenario.isActive ? 'outline' : 'destructive'}>
              {scenario.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {scenario.mitreAttackIds?.map((id: string) => (
              <MitreAttackBadge key={id} id={id} showName />
            ))}
          </div>
          <CardTitle className="text-2xl mt-2">{scenario.name}</CardTitle>
          <p className="text-muted-foreground">{scenario.category}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{scenario.description}</p>

          <div className="flex gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{scenario.estimatedMinutes} min estimated</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>{scenario.stages?.length || 0} stages</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              <span>{scenario.checkpoints?.length || 0} checkpoints</span>
            </div>
          </div>

          {scenario.briefing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Trainee Briefing
              </h3>
              <p className="text-sm whitespace-pre-wrap">{scenario.briefing}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stages & Checkpoints Breakdown */}
      <div>
        <h2 className="text-xl font-bold mb-4">Stage-by-Stage Breakdown</h2>
        <div className="space-y-6">
          {scenario.stages?.map((stage: any) => {
            const stageCheckpoints = checkpointsByStage[stage.stageNumber] || [];

            return (
              <Card key={stage.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {stage.stageNumber}
                      </span>
                      {stage.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {stage.unlockCondition.replace(/_/g, ' ')}
                      </Badge>
                      {stage.unlockDelay && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {stage.unlockDelay}s delay
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stage Description */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">What the trainee should do</h4>
                    <p className="text-sm">{stage.description || 'No description provided.'}</p>
                  </div>

                  {/* Stage Info: logs, hints */}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" /> {stage._count?.logs || 0} logs
                    </span>
                    <span className="flex items-center gap-1">
                      <Lightbulb className="h-4 w-4" /> {stage.hints?.length || 0} hints available
                    </span>
                  </div>

                  {/* Hints */}
                  {stage.hints?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" /> Hints
                      </h4>
                      <div className="space-y-1 ml-6">
                        {stage.hints.map((hint: any, hi: number) => (
                          <div key={hint.id} className="text-sm flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded">
                            <span className="text-muted-foreground font-mono text-xs mt-0.5">{hi + 1}.</span>
                            <div className="flex-1">
                              <p>{hint.content}</p>
                              <span className="text-xs text-muted-foreground">-{hint.pointsPenalty} pts penalty</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checkpoints for this stage */}
                  {stageCheckpoints.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-500" /> Checkpoints ({stageCheckpoints.length})
                      </h4>
                      <div className="space-y-3 ml-6">
                        {stageCheckpoints.map((cp: any, ci: number) => (
                          <div key={cp.id} className="border rounded-lg p-4 space-y-3">
                            {/* Question Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span className="font-medium text-sm">Q{ci + 1}: {cp.question}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-xs">
                                  {checkpointTypeLabels[cp.checkpointType] || cp.checkpointType}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">{cp.points} pts</Badge>
                              </div>
                            </div>

                            {/* Options (for MC, TF, etc.) */}
                            {cp.options && Array.isArray(cp.options) && cp.options.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Options</span>
                                <div className="grid gap-1">
                                  {cp.options.map((opt: string, oi: number) => {
                                    const isCorrect = cp.correctAnswer === opt
                                      || (Array.isArray(cp.correctAnswer) && cp.correctAnswer.includes(opt))
                                      || String(cp.correctAnswer) === String(oi)
                                      || String(cp.correctAnswer) === opt;
                                    return (
                                      <div
                                        key={oi}
                                        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded ${
                                          isCorrect
                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                            : 'bg-muted/50'
                                        }`}
                                      >
                                        {isCorrect ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                        ) : (
                                          <span className="w-4 h-4 rounded-full border border-muted-foreground/30 shrink-0" />
                                        )}
                                        <span>{opt}</span>
                                        {isCorrect && <span className="text-xs text-green-600 font-medium ml-auto">Correct</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Correct Answer (for non-MC types) */}
                            {(!cp.options || cp.options.length === 0) && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Expected Answer
                                </span>
                                <p className="text-sm mt-1">
                                  {typeof cp.correctAnswer === 'object'
                                    ? JSON.stringify(cp.correctAnswer, null, 2)
                                    : String(cp.correctAnswer)}
                                </p>
                              </div>
                            )}

                            {/* Explanation */}
                            {cp.explanation && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Explanation
                                </span>
                                <p className="text-sm mt-1">{cp.explanation}</p>
                              </div>
                            )}

                            {cp.category && (
                              <div className="text-xs text-muted-foreground">
                                Score category: <span className="font-medium">{cp.category}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stageCheckpoints.length === 0 && (
                    <p className="text-sm text-muted-foreground italic ml-6">No checkpoints in this stage.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">
                {scenario.checkpoints?.reduce((sum: number, cp: any) => sum + (cp.points || 0), 0) || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{scenario.checkpoints?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{scenario.stages?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Stages</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">
                {scenario.stages?.reduce((sum: number, s: any) => sum + (s.hints?.length || 0), 0) || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Hints</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
