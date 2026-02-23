'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { CheckCircle, XCircle, Info, ArrowRight, Sparkles } from 'lucide-react';
import { YaraRuleEditor } from './YaraRuleEditor';

interface CheckpointModalProps {
  checkpoints: any[];
  attemptId: string;
  onComplete: () => void;
  onClose: () => void;
  onAnswered: (checkpointId: string) => void;
}

export function CheckpointModal({ checkpoints, attemptId, onComplete, onClose, onAnswered }: CheckpointModalProps) {
  // Capture a stable copy of checkpoints on mount so external query
  // invalidation doesn't shrink the list while the modal is open
  const [stableCheckpoints] = useState(() => checkpoints);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showFinish, setShowFinish] = useState(false);

  const cp = stableCheckpoints[currentIndex];
  if (!cp) return null;

  const handleSubmitAnswer = async () => {
    const answer = answers[cp.id];
    if (answer === undefined || answer === '') {
      toast({ title: 'Please provide an answer', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(`/attempts/${attemptId}/answers`, {
        checkpointId: cp.id,
        answer,
      });
      setResults(prev => ({ ...prev, [cp.id]: data }));
      onAnswered(cp.id);

      // If correct answer is included (beginner wrong answer), don't auto-advance
      const hasCorrectAnswer = data.correctAnswer !== undefined;
      const isLastCheckpoint = currentIndex === stableCheckpoints.length - 1;
      if (!hasCorrectAnswer) {
        if (!isLastCheckpoint) {
          setTimeout(() => setCurrentIndex(currentIndex + 1), 1500);
        } else {
          // Last checkpoint: require manual click so trainee can read feedback
          setShowFinish(true);
        }
      } else if (isLastCheckpoint) {
        setShowFinish(true);
      }
    } catch {
      toast({ title: 'Failed to submit answer', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualAdvance = () => {
    if (currentIndex < stableCheckpoints.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const result = results[cp.id];
  const hasCorrectAnswer = result?.correctAnswer !== undefined;

  const formatCorrectAnswer = () => {
    if (!result?.correctAnswer) return null;
    const type = result.checkpointType || cp.checkpointType;
    const correct = result.correctAnswer;

    switch (type) {
      case 'TRUE_FALSE':
        return `Correct answer: ${correct === true || correct === 'true' ? 'True' : 'False'}`;
      case 'MULTIPLE_CHOICE':
      case 'RECOMMENDED_ACTION':
      case 'SEVERITY_CLASSIFICATION':
        return `Correct answer: ${correct}`;
      case 'SHORT_ANSWER':
        if (Array.isArray(correct)) return `Expected keywords: ${correct.join(', ')}`;
        if (typeof correct === 'object' && correct.keywords) return `Expected keywords: ${correct.keywords.join(', ')}`;
        return `Expected answer: ${correct}`;
      case 'EVIDENCE_SELECTION':
        if (Array.isArray(correct)) return `Correct evidence: ${correct.join(', ')}`;
        return `Correct evidence: ${correct}`;
      case 'INCIDENT_REPORT': {
        const parts: string[] = [];
        if (correct.keywords) parts.push(`Key points: ${correct.keywords.join(', ')}`);
        if (correct.minRecommendations) parts.push(`Min recommendations: ${correct.minRecommendations}`);
        return parts.join('; ') || null;
      }
      case 'YARA_RULE':
        return null; // Too complex to display
      default:
        return typeof correct === 'string' ? `Correct answer: ${correct}` : null;
    }
  };

  const renderQuestion = () => {
    switch (cp.checkpointType) {
      case 'TRUE_FALSE':
        return (
          <RadioGroup
            value={String(answers[cp.id] ?? '')}
            onValueChange={(v) => setAnswers({ ...answers, [cp.id]: v === 'true' })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true">True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false">False</Label>
            </div>
          </RadioGroup>
        );

      case 'MULTIPLE_CHOICE':
      case 'RECOMMENDED_ACTION':
        return (
          <RadioGroup
            value={answers[cp.id] || ''}
            onValueChange={(v) => setAnswers({ ...answers, [cp.id]: v })}
          >
            {cp.options?.map((opt: string, i: number) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`opt-${i}`} />
                <Label htmlFor={`opt-${i}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'SEVERITY_CLASSIFICATION':
        return (
          <RadioGroup
            value={answers[cp.id] || ''}
            onValueChange={(v) => setAnswers({ ...answers, [cp.id]: v })}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => (
              <div key={sev} className="flex items-center space-x-2">
                <RadioGroupItem value={sev} id={`sev-${sev}`} />
                <Label htmlFor={`sev-${sev}`}>{sev}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'EVIDENCE_SELECTION':
        return (
          <div className="space-y-2">
            {cp.options?.map((opt: string, i: number) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox
                  id={`ev-${i}`}
                  checked={(answers[cp.id] || []).includes(opt)}
                  onCheckedChange={(checked) => {
                    const current = answers[cp.id] || [];
                    const updated = checked
                      ? [...current, opt]
                      : current.filter((v: string) => v !== opt);
                    setAnswers({ ...answers, [cp.id]: updated });
                  }}
                />
                <Label htmlFor={`ev-${i}`}>{opt}</Label>
              </div>
            ))}
          </div>
        );

      case 'SHORT_ANSWER':
        return (
          <Textarea
            value={answers[cp.id] || ''}
            onChange={(e) => setAnswers({ ...answers, [cp.id]: e.target.value })}
            placeholder="Type your answer..."
            rows={4}
          />
        );

      case 'INCIDENT_REPORT':
        return (
          <div className="space-y-3">
            <div>
              <Label>Incident Summary</Label>
              <Textarea
                value={answers[cp.id]?.summary || ''}
                onChange={(e) => setAnswers({
                  ...answers,
                  [cp.id]: { ...answers[cp.id], summary: e.target.value },
                })}
                placeholder="Describe the incident..."
                rows={4}
              />
            </div>
            <div>
              <Label>Recommendations (one per line)</Label>
              <Textarea
                value={answers[cp.id]?.recommendations?.join('\n') || ''}
                onChange={(e) => setAnswers({
                  ...answers,
                  [cp.id]: {
                    ...answers[cp.id],
                    recommendations: e.target.value.split('\n').filter((l: string) => l.trim()),
                  },
                })}
                placeholder="1. Isolate the host\n2. Block the IOC\n3. Escalate to IR team"
                rows={4}
              />
            </div>
          </div>
        );

      case 'YARA_RULE': {
        const correctAnswerData = cp.correctAnswer as any;
        const samplesMeta = (correctAnswerData?.samples || []).map((s: any) => ({
          name: s.name,
          description: s.description || '',
          shouldMatch: s.shouldMatch,
          previewStrings: s.previewStrings || [],
          previewHex: s.previewHex || '',
        }));
        return (
          <YaraRuleEditor
            checkpointId={cp.id}
            samples={samplesMeta}
            value={answers[cp.id] || ''}
            onChange={(v) => setAnswers({ ...answers, [cp.id]: v })}
          />
        );
      }

      default:
        return <p className="text-muted-foreground">Unknown question type</p>;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`max-w-[95vw] ${cp.checkpointType === 'YARA_RULE' ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[80vh] flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Checkpoint Question
            <Badge variant="outline">{currentIndex + 1}/{stableCheckpoints.length}</Badge>
            <Badge variant="secondary">{cp.points} pts</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm font-medium">{cp.question}</p>

          {result ? (
            <>
              <div className={`flex items-center gap-2 p-3 rounded-md ${result.isCorrect ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>
                {result.isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <div>
                  <p className="font-medium">{result.isCorrect ? 'Correct!' : 'Incorrect'}</p>
                  <p className="text-xs">Points awarded: {result.pointsAwarded}/{cp.points}</p>
                </div>
              </div>
              {result.feedback && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-400 rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">AI Feedback</p>
                  </div>
                  <p className="text-sm">{result.feedback}</p>
                </div>
              )}
              {hasCorrectAnswer && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400 rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">Learning Feedback</p>
                  </div>
                  {formatCorrectAnswer() && (
                    <p className="text-sm">{formatCorrectAnswer()}</p>
                  )}
                  {result.explanation && (
                    <p className="text-sm mt-1">{result.explanation}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            renderQuestion()
          )}
        </div>
        <DialogFooter className="flex-shrink-0">
          {!result && (
            <Button onClick={handleSubmitAnswer} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          )}
          {result && hasCorrectAnswer && !showFinish && (
            <Button onClick={handleManualAdvance}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {result && showFinish && (
            <Button onClick={() => onComplete()}>
              Finish Stage
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
