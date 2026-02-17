'use client';

import { useParams } from 'next/navigation';
import { useSession, useUpdateSessionStatus } from '@/hooks/useSessions';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api';
import { getTrainerSocket } from '@/lib/socket';
import {
  Play, Pause, Square, Send, Eye, Users, Activity, MessageSquare,
  Search, FileText, Lightbulb, CheckCircle2, ArrowRight, Bookmark,
  Clock, X, AlertTriangle,
} from 'lucide-react';

interface ActionEntry {
  type: string;
  detail: string;
  time: string;
}

interface TraineeState {
  attemptId: string;
  userId: string;
  userName: string;
  currentStage: number;
  totalStages: number;
  currentScore: number;
  lastAction: string;
  elapsedMinutes: number;
  status: string;
  actions: ActionEntry[];
  actionsLoaded: boolean;
}

// Map action types to readable labels and icons
const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  EVIDENCE_ADDED: { label: 'Collected Evidence', icon: Bookmark, color: 'text-green-600' },
  EVIDENCE_REMOVED: { label: 'Removed Evidence', icon: X, color: 'text-red-500' },
  TIMELINE_ENTRY_ADDED: { label: 'Added Timeline Entry', icon: Clock, color: 'text-blue-600' },
  TIMELINE_ENTRY_REMOVED: { label: 'Removed Timeline Entry', icon: X, color: 'text-red-500' },
  LOG_VIEWED: { label: 'Viewed Log', icon: Search, color: 'text-slate-600' },
  LOG_EXPANDED: { label: 'Expanded Log', icon: FileText, color: 'text-slate-600' },
  HINT_REQUESTED: { label: 'Used Hint', icon: Lightbulb, color: 'text-yellow-600' },
  TRAINER_HINT: { label: 'Trainer Sent Hint', icon: MessageSquare, color: 'text-purple-600' },
  CHECKPOINT_ANSWERED: { label: 'Answered Checkpoint', icon: CheckCircle2, color: 'text-green-600' },
  STAGE_UNLOCKED: { label: 'Advanced Stage', icon: ArrowRight, color: 'text-blue-600' },
  SEARCH_PERFORMED: { label: 'Searched Logs', icon: Search, color: 'text-slate-500' },
  FILTER_APPLIED: { label: 'Filtered Logs', icon: Search, color: 'text-slate-500' },
};

function formatActionDetail(actionType: string, details: any): string {
  if (!details) return '';
  switch (actionType) {
    case 'EVIDENCE_ADDED':
      return details.summary || details.logId || '';
    case 'EVIDENCE_REMOVED':
      return details.logId || '';
    case 'TIMELINE_ENTRY_ADDED':
      return details.description || details.title || '';
    case 'HINT_REQUESTED':
      if (details.fromTrainer) return `Trainer: "${details.trainerHint}"`;
      return details.hintId ? `Hint penalty: -${details.penalty || 0} pts` : '';
    case 'TRAINER_HINT':
      return details.content || details.trainerHint || '';
    case 'STAGE_UNLOCKED':
      return `Stage ${details.newStage}`;
    case 'CHECKPOINT_ANSWERED':
      return details.question ? `"${details.question}"` : '';
    case 'LOG_VIEWED':
    case 'LOG_EXPANDED':
      return details.summary || '';
    case 'SEARCH_PERFORMED':
      return details.query ? `"${details.query}"` : '';
    default:
      if (typeof details === 'string') return details;
      if (details.summary) return details.summary;
      return '';
  }
}

export default function SessionMonitorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, refetch } = useSession(sessionId);
  const updateStatus = useUpdateSessionStatus();

  const [trainees, setTrainees] = useState<Map<string, TraineeState>>(new Map());
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [hintDialogOpen, setHintDialogOpen] = useState(false);
  const [hintContent, setHintContent] = useState('');
  const [hintType, setHintType] = useState<'custom' | 'predefined'>('custom');

  // Auto-refresh session data every 10 seconds as fallback for socket
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Initialize trainee states from session data (preserve existing actions)
  useEffect(() => {
    if (session?.attempts) {
      setTrainees(prev => {
        const map = new Map<string, TraineeState>();
        for (const attempt of session.attempts) {
          const existing = prev.get(attempt.userId);
          map.set(attempt.userId, {
            attemptId: attempt.id,
            userId: attempt.userId,
            userName: attempt.user?.name || attempt.user?.email || 'Unknown',
            currentStage: attempt.currentStage,
            totalStages: session.scenario?.stages?.length || 0,
            currentScore: attempt.totalScore,
            lastAction: existing?.lastAction || '',
            elapsedMinutes: attempt.startedAt
              ? Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 60000)
              : 0,
            status: attempt.status,
            actions: existing?.actions || [],
            actionsLoaded: existing?.actionsLoaded || false,
          });
        }
        return map;
      });
    }
  }, [session]);

  // Load existing actions when a trainee is selected
  useEffect(() => {
    if (!selectedTrainee) return;
    const trainee = trainees.get(selectedTrainee);
    if (!trainee || trainee.actionsLoaded) return;

    (async () => {
      try {
        const { data: attempt } = await api.get(`/attempts/${trainee.attemptId}`);
        const existingActions: ActionEntry[] = (attempt.actions || []).map((a: any) => ({
          type: a.actionType,
          detail: formatActionDetail(a.actionType, a.details),
          time: new Date(a.createdAt).toLocaleTimeString(),
        }));

        setTrainees(prev => {
          const updated = new Map(prev);
          const t = updated.get(selectedTrainee);
          if (t) {
            updated.set(selectedTrainee, {
              ...t,
              actions: [...existingActions],
              actionsLoaded: true,
            });
          }
          return updated;
        });
      } catch {
        // Failed to load — will still get real-time updates
      }
    })();
  }, [selectedTrainee, trainees]);

  // Socket.io for real-time updates
  useEffect(() => {
    const socket = getTrainerSocket();
    socket.auth = { token: localStorage.getItem('token') };
    socket.connect();
    socket.emit('join-session', sessionId);

    socket.on('progress-update', (data: any) => {
      setTrainees(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.userId);
        if (existing) {
          const detail = formatActionDetail(data.lastAction, data.details);
          updated.set(data.userId, {
            ...existing,
            currentStage: data.currentStage ?? existing.currentStage,
            currentScore: data.currentScore ?? existing.currentScore,
            lastAction: data.lastAction || existing.lastAction,
            elapsedMinutes: data.elapsedMinutes ?? existing.elapsedMinutes,
            actions: [
              { type: data.lastAction, detail, time: new Date().toLocaleTimeString() },
              ...existing.actions.slice(0, 99),
            ],
          });
        }
        return updated;
      });
    });

    return () => {
      socket.off('progress-update');
      socket.disconnect();
    };
  }, [sessionId]);

  const handleStatusChange = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: sessionId, status });
      refetch();
      toast({ title: `Session ${status.toLowerCase()}` });
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleSendHint = async () => {
    if (!selectedTrainee || !hintContent.trim()) return;
    const trainee = trainees.get(selectedTrainee);
    if (!trainee) return;

    try {
      // Record the hint as an action on the attempt
      await api.post(`/attempts/${trainee.attemptId}/actions`, {
        actionType: 'TRAINER_HINT',
        details: { content: hintContent, fromTrainer: true },
      });

      // Emit hint to trainee via socket
      const socket = getTrainerSocket();
      socket.emit('send-hint', {
        attemptId: trainee.attemptId,
        content: hintContent,
      });

      // Add to local activity feed immediately
      setTrainees(prev => {
        const updated = new Map(prev);
        const t = updated.get(selectedTrainee);
        if (t) {
          updated.set(selectedTrainee, {
            ...t,
            actions: [
              { type: 'TRAINER_HINT', detail: hintContent, time: new Date().toLocaleTimeString() },
              ...t.actions.slice(0, 99),
            ],
          });
        }
        return updated;
      });

      toast({ title: 'Hint sent to ' + trainee.userName });
      setHintDialogOpen(false);
      setHintContent('');
    } catch {
      toast({ title: 'Failed to send hint', variant: 'destructive' });
    }
  };

  // Get predefined hints for the current stage
  const getPredefinedHints = (): { content: string; penalty: number }[] => {
    if (!selectedTrainee || !session?.scenario?.stages) return [];
    const trainee = trainees.get(selectedTrainee);
    if (!trainee) return [];
    const stage = session.scenario.stages.find(
      (s: any) => s.stageNumber === trainee.currentStage
    );
    return stage?.hints || [];
  };

  const selectedTraineeData = selectedTrainee ? trainees.get(selectedTrainee) : null;
  const traineeList = Array.from(trainees.values());
  const predefinedHints = getPredefinedHints();

  const statusColors: Record<string, string> = {
    IN_PROGRESS: 'bg-green-500',
    COMPLETED: 'bg-blue-500',
    NOT_STARTED: 'bg-slate-400',
    TIMED_OUT: 'bg-red-500',
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{session?.name || 'Session Monitor'}</h1>
          <p className="text-sm text-muted-foreground">{session?.scenario?.name}</p>
        </div>
        <div className="flex gap-2">
          {session?.status === 'ACTIVE' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('PAUSED')}>
                <Pause className="mr-1 h-4 w-4" /> Pause
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleStatusChange('COMPLETED')}>
                <Square className="mr-1 h-4 w-4" /> End Session
              </Button>
            </>
          )}
          {session?.status === 'PAUSED' && (
            <Button size="sm" onClick={() => handleStatusChange('ACTIVE')}>
              <Play className="mr-1 h-4 w-4" /> Resume
            </Button>
          )}
          {session?.status === 'DRAFT' && (
            <Button size="sm" onClick={() => handleStatusChange('ACTIVE')}>
              <Play className="mr-1 h-4 w-4" /> Launch
            </Button>
          )}
          <Badge variant="outline" className="text-sm">
            {session?.status || 'UNKNOWN'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Trainee List */}
        <Card className="w-72 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Trainees ({traineeList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-1">
                {traineeList.map((t) => (
                  <button
                    key={t.userId}
                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                      selectedTrainee === t.userId ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedTrainee(t.userId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[t.status] || 'bg-slate-400'}`} />
                      <span className="font-medium truncate">{t.userName}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span>Stage {t.currentStage}/{t.totalStages}</span>
                      <span className="font-semibold">{t.currentScore} pts</span>
                    </div>
                    {t.lastAction && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {ACTION_CONFIG[t.lastAction]?.label || t.lastAction.replace(/_/g, ' ')}
                      </div>
                    )}
                  </button>
                ))}
                {traineeList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No trainees active</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Trainee Detail */}
        <Card className="flex-1 flex flex-col">
          {selectedTraineeData ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedTraineeData.userName}</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setHintDialogOpen(true)}>
                      <MessageSquare className="mr-1 h-3 w-3" /> Send Hint
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3 text-sm flex-wrap">
                  <Badge variant="outline">Stage {selectedTraineeData.currentStage}/{selectedTraineeData.totalStages}</Badge>
                  <Badge variant="outline">{selectedTraineeData.currentScore} points</Badge>
                  <Badge variant="outline">{selectedTraineeData.elapsedMinutes} min elapsed</Badge>
                  <Badge
                    variant="outline"
                    className={selectedTraineeData.status === 'IN_PROGRESS' ? 'border-green-500 text-green-700' :
                               selectedTraineeData.status === 'COMPLETED' ? 'border-blue-500 text-blue-700' : ''}
                  >
                    {selectedTraineeData.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="flex-1 overflow-hidden pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Live Activity Feed
                  <span className="text-xs text-muted-foreground font-normal">
                    ({selectedTraineeData.actions.length} actions)
                  </span>
                </h4>
                <ScrollArea className="h-[calc(100%-2.5rem)]">
                  <div className="space-y-1.5">
                    {!selectedTraineeData.actionsLoaded ? (
                      <p className="text-sm text-muted-foreground">Loading activity...</p>
                    ) : selectedTraineeData.actions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      selectedTraineeData.actions.map((action, i) => {
                        const config = ACTION_CONFIG[action.type];
                        const Icon = config?.icon || Activity;
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                            <span className="text-xs text-muted-foreground font-mono w-16 shrink-0 mt-0.5">
                              {action.time}
                            </span>
                            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config?.color || 'text-muted-foreground'}`} />
                            <div className="min-w-0">
                              <span className="font-medium text-xs">
                                {config?.label || action.type.replace(/_/g, ' ')}
                              </span>
                              {action.detail && (
                                <p className="text-xs text-muted-foreground truncate">{action.detail}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p>Select a trainee to view their progress</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Send Hint Dialog */}
      <Dialog open={hintDialogOpen} onOpenChange={setHintDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Hint to {selectedTraineeData?.userName}</DialogTitle>
            <DialogDescription>
              Currently on Stage {selectedTraineeData?.currentStage} of {selectedTraineeData?.totalStages}
            </DialogDescription>
          </DialogHeader>

          {/* Predefined hints from the scenario */}
          {predefinedHints.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Predefined Stage Hints</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {predefinedHints.map((h: any, i: number) => (
                  <button
                    key={i}
                    className={`w-full text-left text-sm p-2 rounded border transition-colors ${
                      hintContent === h.content ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => setHintContent(h.content)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{h.content}</span>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">-{h.pointsPenalty} pts</Badge>
                    </div>
                  </button>
                ))}
              </div>
              <Separator />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Custom Hint</p>
            <Textarea
              value={hintContent}
              onChange={(e) => setHintContent(e.target.value)}
              placeholder="Type your hint or guidance..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHintDialogOpen(false); setHintContent(''); }}>
              Cancel
            </Button>
            <Button onClick={handleSendHint} disabled={!hintContent.trim()}>
              <Send className="mr-2 h-4 w-4" /> Send Hint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
