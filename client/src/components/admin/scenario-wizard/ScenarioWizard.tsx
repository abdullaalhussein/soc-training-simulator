'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreateScenario } from '@/hooks/useScenarios';
import { toast } from '@/components/ui/toaster';
import { Plus, Trash2, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface ScenarioWizardProps {
  onComplete: () => void;
}

const steps = ['Basic Info', 'Stages', 'Checkpoints', 'Review'];

export function ScenarioWizard({ onComplete }: ScenarioWizardProps) {
  const [step, setStep] = useState(0);
  const createScenario = useCreateScenario();

  const [basicInfo, setBasicInfo] = useState({
    name: '', description: '', category: '', difficulty: 'BEGINNER',
    mitreAttackIds: '', briefing: '', estimatedMinutes: 45,
  });

  const [stages, setStages] = useState<any[]>([
    { stageNumber: 1, title: '', description: '', unlockCondition: 'AFTER_PREVIOUS', logs: [], hints: [] },
  ]);

  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  const addStage = () => {
    setStages([...stages, {
      stageNumber: stages.length + 1, title: '', description: '',
      unlockCondition: 'AFTER_CHECKPOINT', logs: [], hints: [],
    }]);
  };

  const removeStage = (i: number) => {
    const updated = stages.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stageNumber: idx + 1 }));
    setStages(updated);
  };

  const addCheckpoint = () => {
    setCheckpoints([...checkpoints, {
      stageNumber: 1, checkpointType: 'MULTIPLE_CHOICE', question: '',
      options: ['', '', '', ''], correctAnswer: '', points: 10, category: 'accuracy',
    }]);
  };

  const removeCheckpoint = (i: number) => {
    setCheckpoints(checkpoints.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    try {
      await createScenario.mutateAsync({
        ...basicInfo,
        mitreAttackIds: basicInfo.mitreAttackIds.split(',').map(s => s.trim()).filter(Boolean),
        stages: stages.map(s => ({
          stageNumber: s.stageNumber,
          title: s.title,
          description: s.description,
          unlockCondition: s.unlockCondition,
          hints: s.hints,
        })),
        checkpoints: checkpoints.map(c => ({
          ...c,
          options: c.checkpointType === 'SHORT_ANSWER' || c.checkpointType === 'INCIDENT_REPORT'
            ? undefined : c.options?.filter((o: string) => o),
        })),
      });
      toast({ title: 'Scenario created successfully' });
      onComplete();
    } catch {
      toast({ title: 'Failed to create scenario', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
              ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="ml-2 text-sm hidden md:inline">{s}</span>
            {i < steps.length - 1 && <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scenario Name</Label>
              <Input value={basicInfo.name} onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })} placeholder="e.g., Phishing Attack Investigation" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={basicInfo.category} onChange={(e) => setBasicInfo({ ...basicInfo, category: e.target.value })} placeholder="e.g., Email Threats" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={basicInfo.difficulty} onValueChange={(v) => setBasicInfo({ ...basicInfo, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated Minutes</Label>
              <Input type="number" value={basicInfo.estimatedMinutes} onChange={(e) => setBasicInfo({ ...basicInfo, estimatedMinutes: parseInt(e.target.value) || 45 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>MITRE ATT&CK IDs (comma-separated)</Label>
            <Input value={basicInfo.mitreAttackIds} onChange={(e) => setBasicInfo({ ...basicInfo, mitreAttackIds: e.target.value })} placeholder="T1566.001, T1059.001" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={basicInfo.description} onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })} placeholder="Brief overview..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Briefing (Markdown supported)</Label>
            <Textarea value={basicInfo.briefing} onChange={(e) => setBasicInfo({ ...basicInfo, briefing: e.target.value })} placeholder="## Scenario Briefing\n\nYou are a Tier 1 SOC Analyst..." rows={6} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {stages.map((stage, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Stage {stage.stageNumber}</CardTitle>
                  {stages.length > 1 && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeStage(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={stage.title} onChange={(e) => {
                      const updated = [...stages];
                      updated[i].title = e.target.value;
                      setStages(updated);
                    }} placeholder="Stage title" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unlock Condition</Label>
                    <Select value={stage.unlockCondition} onValueChange={(v) => {
                      const updated = [...stages];
                      updated[i].unlockCondition = v;
                      setStages(updated);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AFTER_PREVIOUS">After Previous</SelectItem>
                        <SelectItem value="AFTER_CHECKPOINT">After Checkpoint</SelectItem>
                        <SelectItem value="AFTER_TIME_DELAY">After Time Delay</SelectItem>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={stage.description} onChange={(e) => {
                    const updated = [...stages];
                    updated[i].description = e.target.value;
                    setStages(updated);
                  }} placeholder="What should the trainee investigate?" rows={2} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addStage}><Plus className="mr-2 h-4 w-4" /> Add Stage</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {checkpoints.map((cp, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Checkpoint {i + 1}</CardTitle>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeCheckpoint(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Stage</Label>
                    <Select value={String(cp.stageNumber)} onValueChange={(v) => {
                      const updated = [...checkpoints];
                      updated[i].stageNumber = parseInt(v);
                      setCheckpoints(updated);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => <SelectItem key={s.stageNumber} value={String(s.stageNumber)}>Stage {s.stageNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={cp.checkpointType} onValueChange={(v) => {
                      const updated = [...checkpoints];
                      updated[i].checkpointType = v;
                      setCheckpoints(updated);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                        <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                        <SelectItem value="SEVERITY_CLASSIFICATION">Severity</SelectItem>
                        <SelectItem value="RECOMMENDED_ACTION">Recommended Action</SelectItem>
                        <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                        <SelectItem value="INCIDENT_REPORT">Incident Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Points</Label>
                    <Input type="number" value={cp.points} onChange={(e) => {
                      const updated = [...checkpoints];
                      updated[i].points = parseInt(e.target.value) || 10;
                      setCheckpoints(updated);
                    }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Question</Label>
                  <Textarea value={cp.question} onChange={(e) => {
                    const updated = [...checkpoints];
                    updated[i].question = e.target.value;
                    setCheckpoints(updated);
                  }} rows={2} />
                </div>
                {['MULTIPLE_CHOICE', 'RECOMMENDED_ACTION', 'EVIDENCE_SELECTION'].includes(cp.checkpointType) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Options (one per line)</Label>
                    <Textarea value={cp.options?.join('\n') || ''} onChange={(e) => {
                      const updated = [...checkpoints];
                      updated[i].options = e.target.value.split('\n');
                      setCheckpoints(updated);
                    }} rows={4} placeholder="Option 1\nOption 2\nOption 3\nOption 4" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Correct Answer</Label>
                  <Input value={typeof cp.correctAnswer === 'object' ? JSON.stringify(cp.correctAnswer) : cp.correctAnswer} onChange={(e) => {
                    const updated = [...checkpoints];
                    updated[i].correctAnswer = e.target.value;
                    setCheckpoints(updated);
                  }} placeholder="Enter correct answer" />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addCheckpoint}><Plus className="mr-2 h-4 w-4" /> Add Checkpoint</Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Review</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold">{basicInfo.name || '(Unnamed)'}</h3>
                <p className="text-sm text-muted-foreground">{basicInfo.description || '(No description)'}</p>
                <div className="flex gap-2 mt-2">
                  <Badge>{basicInfo.difficulty}</Badge>
                  <Badge variant="outline">{basicInfo.category || 'Uncategorized'}</Badge>
                  <Badge variant="secondary">{basicInfo.estimatedMinutes} min</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Stages ({stages.length})</h4>
                {stages.map((s) => (
                  <div key={s.stageNumber} className="text-sm ml-4">
                    {s.stageNumber}. {s.title || '(Untitled)'} - {s.unlockCondition}
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Checkpoints ({checkpoints.length})</h4>
                {checkpoints.map((c, i) => (
                  <div key={i} className="text-sm ml-4">
                    Stage {c.stageNumber}: {c.checkpointType} - {c.points}pts
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createScenario.isPending}>
            {createScenario.isPending ? 'Creating...' : 'Create Scenario'}
          </Button>
        )}
      </div>
    </div>
  );
}
