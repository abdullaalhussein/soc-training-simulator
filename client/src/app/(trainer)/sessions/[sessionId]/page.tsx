'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession, useUpdateSessionStatus, useAddSessionMembers, useDeleteSession, useRetakeAttempt } from '@/hooks/useSessions';
import { useUsers } from '@/hooks/useUsers';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api';
import { getTrainerSocket } from '@/lib/socket';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { ResultsScreen } from '@/components/scenario-player/ResultsScreen';
import {
  Play, Pause, Square, Send, Eye, Users, Activity, MessageSquare,
  Search, FileText, Lightbulb, CheckCircle2, XCircle, ArrowRight, Bookmark,
  Clock, X, AlertTriangle, UserPlus, Trash2, RotateCcw, ClipboardList, Download,
} from 'lucide-react';

interface ActionEntry {
  type: string;
  detail: string;
  time: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
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
      return details.question || '';
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
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, refetch } = useSession(sessionId);
  const updateStatus = useUpdateSessionStatus();
  const addMembers = useAddSessionMembers();
  const deleteSession = useDeleteSession();
  const retakeAttempt = useRetakeAttempt();
  const { data: allTrainees } = useUsers({ role: 'TRAINEE' });

  const [trainees, setTrainees] = useState<Map<string, TraineeState>>(new Map());
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [hintDialogOpen, setHintDialogOpen] = useState(false);
  const [hintContent, setHintContent] = useState('');
  const [hintType, setHintType] = useState<'custom' | 'predefined'>('custom');
  const [addTraineeDialogOpen, setAddTraineeDialogOpen] = useState(false);
  const [selectedNewTrainees, setSelectedNewTrainees] = useState<string[]>([]);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [startingForTrainee, setStartingForTrainee] = useState<string | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [retakeDialogOpen, setRetakeDialogOpen] = useState(false);
  const [retakeTargetTrainee, setRetakeTargetTrainee] = useState<TraineeState | null>(null);
  const [viewReportAttemptId, setViewReportAttemptId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Auto-refresh session data every 3 seconds as fallback for socket
  useEffect(() => {
    const interval = setInterval(() => refetch(), 3000);
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
          ...(a.actionType === 'CHECKPOINT_ANSWERED' && a.details ? {
            isCorrect: a.details.isCorrect,
            pointsAwarded: a.details.pointsAwarded,
          } : {}),
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
              {
                type: data.lastAction,
                detail,
                time: new Date().toLocaleTimeString(),
                ...(data.lastAction === 'CHECKPOINT_ANSWERED' && data.details ? {
                  isCorrect: data.details.isCorrect,
                  pointsAwarded: data.details.pointsAwarded,
                } : {}),
              },
              ...existing.actions.slice(0, 99),
            ],
          });
        }
        return updated;
      });
    });

    return () => {
      socket.off('progress-update');
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

  const handleDeleteSession = async () => {
    try {
      await deleteSession.mutateAsync(sessionId);
      toast({ title: 'Session deleted' });
      router.push('/console');
    } catch {
      toast({ title: 'Failed to delete session', variant: 'destructive' });
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

  const handleAddTrainees = async (andStart = false) => {
    if (selectedNewTrainees.length === 0) return;
    try {
      await addMembers.mutateAsync({ sessionId, userIds: selectedNewTrainees });

      if (andStart && session?.status === 'ACTIVE') {
        // Start scenario for each added trainee
        await Promise.all(
          selectedNewTrainees.map((userId) =>
            api.post('/attempts/start', { sessionId, userId }).catch(() => {})
          )
        );
        toast({ title: `${selectedNewTrainees.length} trainee${selectedNewTrainees.length > 1 ? 's' : ''} added & started` });
      } else {
        toast({ title: `${selectedNewTrainees.length} trainee${selectedNewTrainees.length > 1 ? 's' : ''} added` });
      }

      setAddTraineeDialogOpen(false);
      setSelectedNewTrainees([]);
      setTraineeSearch('');
      refetch();
    } catch {
      toast({ title: 'Failed to add trainees', variant: 'destructive' });
    }
  };

  const handleStartForTrainee = async (userId: string, userName: string) => {
    setStartingForTrainee(userId);
    try {
      await api.post('/attempts/start', { sessionId, userId });
      toast({ title: `Scenario started for ${userName}` });
      refetch();
    } catch {
      toast({ title: 'Failed to start scenario', variant: 'destructive' });
    } finally {
      setStartingForTrainee(null);
    }
  };

  const handleBroadcastAlert = () => {
    if (!alertMessage.trim()) return;
    const socket = getTrainerSocket();
    socket.emit('send-session-alert', { sessionId, message: alertMessage });
    toast({ title: 'Alert broadcast to all trainees' });
    setAlertDialogOpen(false);
    setAlertMessage('');
  };

  const handleDownloadPdf = async (attemptId: string) => {
    setDownloadingPdf(true);
    try {
      const { data } = await api.get(`/reports/attempt/${attemptId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${attemptId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Failed to download PDF', variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
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

  // Build the full member list: members with attempts + assigned-only members
  const existingMemberIds = useMemo(() => {
    const ids = new Set<string>();
    session?.members?.forEach((m: any) => ids.add(m.userId));
    return ids;
  }, [session?.members]);

  // Members who are assigned but haven't started an attempt yet
  const assignedOnlyMembers: { userId: string; userName: string; status: string }[] = useMemo(() => {
    if (!session?.members) return [];
    const attemptUserIds = new Set(traineeList.map(t => t.userId));
    return session.members
      .filter((m: any) => !attemptUserIds.has(m.userId))
      .map((m: any) => ({
        userId: m.userId as string,
        userName: (m.user?.name || m.user?.email || 'Unknown') as string,
        status: (m.status || 'ASSIGNED') as string,
      }));
  }, [session?.members, traineeList]);

  // Available trainees to add (not already session members)
  const availableTrainees = useMemo(() => {
    if (!allTrainees) return [];
    return allTrainees.filter((t: any) => t.isActive && !existingMemberIds.has(t.id));
  }, [allTrainees, existingMemberIds]);

  const filteredAvailableTrainees = useMemo(() => {
    if (!traineeSearch) return availableTrainees;
    const q = traineeSearch.toLowerCase();
    return availableTrainees.filter(
      (t: any) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [availableTrainees, traineeSearch]);

  const statusColors: Record<string, string> = {
    IN_PROGRESS: 'bg-green-500',
    COMPLETED: 'bg-blue-500',
    NOT_STARTED: 'bg-slate-400',
    TIMED_OUT: 'bg-red-500',
    ASSIGNED: 'bg-amber-400',
    RETAKEN: 'bg-orange-400',
  };

  // Selected member info (could be from attempts or assigned-only)
  const selectedAssignedMember = !selectedTraineeData && selectedTrainee
    ? assignedOnlyMembers.find((m: { userId: string; userName: string; status: string }) => m.userId === selectedTrainee)
    : null;

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{session?.name || 'Session Monitor'}</h1>
          <p className="text-sm text-muted-foreground">{session?.scenario?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setAddTraineeDialogOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Add Trainee
          </Button>
          {session?.status === 'ACTIVE' && (
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20" onClick={() => setAlertDialogOpen(true)}>
              <AlertTriangle className="mr-1 h-4 w-4" /> Broadcast Alert
            </Button>
          )}
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
          {(session?.status === 'COMPLETED' || session?.status === 'DRAFT') && (
            <Button size="sm" variant="destructive" onClick={handleDeleteSession} disabled={deleteSession.isPending}>
              <Trash2 className="mr-1 h-4 w-4" /> {deleteSession.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Badge variant="outline" className="text-sm">
            {session?.status || 'UNKNOWN'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Trainee List - horizontal chips on mobile, sidebar on desktop */}
        <div className="md:hidden shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 px-1">
            {traineeList.map((t) => (
              <button
                key={t.userId}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedTrainee === t.userId ? 'bg-primary/10 border-primary/30 font-medium' : 'hover:bg-muted border-border'
                }`}
                onClick={() => setSelectedTrainee(t.userId)}
              >
                <div className={`w-2 h-2 rounded-full ${statusColors[t.status] || 'bg-slate-400'}`} />
                <span className="truncate max-w-[120px]">{t.userName}</span>
                <span className="text-xs text-muted-foreground">{t.currentScore}pts</span>
              </button>
            ))}
            {assignedOnlyMembers.map((m) => (
              <button
                key={m.userId}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedTrainee === m.userId ? 'bg-primary/10 border-primary/30 font-medium' : 'hover:bg-muted border-border'
                }`}
                onClick={() => setSelectedTrainee(m.userId)}
              >
                <div className={`w-2 h-2 rounded-full ${statusColors.ASSIGNED}`} />
                <span className="truncate max-w-[120px]">{m.userName}</span>
                <span className="text-xs text-muted-foreground">Assigned</span>
              </button>
            ))}
            {traineeList.length === 0 && assignedOnlyMembers.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No trainees yet</p>
            )}
          </div>
        </div>

        <Card className="w-72 hidden md:flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Trainees ({traineeList.length + assignedOnlyMembers.length})
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
                {assignedOnlyMembers.length > 0 && traineeList.length > 0 && (
                  <Separator className="my-2" />
                )}
                {assignedOnlyMembers.map((m) => (
                  <button
                    key={m.userId}
                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                      selectedTrainee === m.userId ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedTrainee(m.userId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors.ASSIGNED}`} />
                      <span className="font-medium truncate">{m.userName}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Assigned — not started
                    </div>
                  </button>
                ))}
                {traineeList.length === 0 && assignedOnlyMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No trainees yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Trainee Detail */}
        <Card className="flex-1 flex flex-col min-h-0">
          {selectedTraineeData ? (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{selectedTraineeData.userName}</CardTitle>
                <div className="flex gap-3 text-sm flex-wrap">
                  <Badge variant="outline">Stage {selectedTraineeData.currentStage}/{selectedTraineeData.totalStages}</Badge>
                  <Badge variant="outline">{selectedTraineeData.currentScore} points</Badge>
                  <Badge variant="outline">{selectedTraineeData.elapsedMinutes} min elapsed</Badge>
                  <Badge
                    variant="outline"
                    className={selectedTraineeData.status === 'IN_PROGRESS' ? 'border-green-500 text-green-700 dark:text-green-400' :
                               selectedTraineeData.status === 'COMPLETED' ? 'border-blue-500 text-blue-700 dark:text-blue-400' : ''}
                  >
                    {selectedTraineeData.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setHintDialogOpen(true)}>
                    <MessageSquare className="mr-1 h-3 w-3" /> Send Hint
                  </Button>
                  {['COMPLETED', 'TIMED_OUT'].includes(selectedTraineeData.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setViewReportAttemptId(selectedTraineeData.attemptId)}>
                        <ClipboardList className="mr-1 h-3 w-3" /> View Report
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(selectedTraineeData.attemptId)} disabled={downloadingPdf}>
                        <Download className="mr-1 h-3 w-3" /> {downloadingPdf ? 'Downloading...' : 'PDF'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                        onClick={() => {
                          setRetakeTargetTrainee(selectedTraineeData);
                          setRetakeDialogOpen(true);
                        }}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> Retake
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="flex-1 overflow-hidden pt-0">
                <Tabs defaultValue="activity" className="flex flex-col h-full">
                  <TabsList className="w-full shrink-0 mt-2">
                    <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                    <TabsTrigger value="discussion" className="flex-1">Discussion</TabsTrigger>
                  </TabsList>
                  <TabsContent value="activity" className="flex-1 overflow-hidden mt-2 data-[state=active]:flex data-[state=active]:flex-col">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" /> Live Activity Feed
                      <span className="text-xs text-muted-foreground font-normal">
                        ({selectedTraineeData.actions.length} actions)
                      </span>
                    </h4>
                    <ScrollArea className="flex-1">
                      <div className="space-y-1.5">
                        {!selectedTraineeData.actionsLoaded ? (
                          <p className="text-sm text-muted-foreground">Loading activity...</p>
                        ) : selectedTraineeData.actions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No activity yet.</p>
                        ) : (
                          selectedTraineeData.actions.map((action, i) => {
                            const config = ACTION_CONFIG[action.type];
                            const isCheckpointAction = action.type === 'CHECKPOINT_ANSWERED' && action.isCorrect !== undefined;
                            const Icon = isCheckpointAction
                              ? (action.isCorrect ? CheckCircle2 : XCircle)
                              : (config?.icon || Activity);
                            const iconColor = isCheckpointAction
                              ? (action.isCorrect ? 'text-green-600' : 'text-red-500')
                              : (config?.color || 'text-muted-foreground');
                            return (
                              <div key={i} className="flex items-start gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                                <span className="text-xs text-muted-foreground font-mono w-16 shrink-0 mt-0.5">
                                  {action.time}
                                </span>
                                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-xs">
                                    {config?.label || action.type.replace(/_/g, ' ')}
                                  </span>
                                  {isCheckpointAction && (
                                    <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 ${action.isCorrect ? 'border-green-300 text-green-700 dark:text-green-400' : 'border-red-300 text-red-700 dark:text-red-400'}`}>
                                      {action.isCorrect ? 'Correct' : 'Incorrect'} {action.pointsAwarded !== undefined ? `+${action.pointsAwarded} pts` : ''}
                                    </Badge>
                                  )}
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
                  </TabsContent>
                  <TabsContent value="discussion" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                    <DiscussionPanel sessionId={sessionId} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : selectedAssignedMember ? (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p className="font-medium text-foreground">{selectedAssignedMember.userName}</p>
                <p className="text-sm mt-1">Assigned to this session but has not started yet.</p>
                <Badge variant="outline" className="mt-2 border-amber-400 text-amber-600 dark:text-amber-400">Waiting to start</Badge>
                {session?.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    className="mt-4"
                    disabled={startingForTrainee === selectedAssignedMember.userId}
                    onClick={() => handleStartForTrainee(selectedAssignedMember.userId, selectedAssignedMember.userName)}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    {startingForTrainee === selectedAssignedMember.userId ? 'Starting...' : 'Start Scenario for Trainee'}
                  </Button>
                )}
              </div>
            </CardContent>
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

      {/* Add Trainee Dialog */}
      <Dialog open={addTraineeDialogOpen} onOpenChange={(open) => {
        setAddTraineeDialogOpen(open);
        if (!open) { setSelectedNewTrainees([]); setTraineeSearch(''); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Trainees to Session</DialogTitle>
            <DialogDescription>
              Select trainees to assign to this session. They will be able to start the scenario once the session is active.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search by name or email..."
            value={traineeSearch}
            onChange={(e) => setTraineeSearch(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
            {filteredAvailableTrainees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {allTrainees?.length === 0 ? 'No trainees exist yet' : 'All trainees are already in this session'}
              </p>
            ) : (
              filteredAvailableTrainees.map((t: any) => (
                <label key={t.id} className="flex items-center gap-3 text-sm cursor-pointer p-2 hover:bg-accent rounded">
                  <Checkbox
                    checked={selectedNewTrainees.includes(t.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedNewTrainees(prev => [...prev, t.id]);
                      else setSelectedNewTrainees(prev => prev.filter(id => id !== t.id));
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedNewTrainees.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedNewTrainees.length} trainee{selectedNewTrainees.length > 1 ? 's' : ''} selected
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddTraineeDialogOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleAddTrainees(false)} disabled={selectedNewTrainees.length === 0 || addMembers.isPending}>
              <UserPlus className="mr-1 h-4 w-4" />
              {addMembers.isPending ? 'Adding...' : 'Add Only'}
            </Button>
            {session?.status === 'ACTIVE' && (
              <Button onClick={() => handleAddTrainees(true)} disabled={selectedNewTrainees.length === 0 || addMembers.isPending}>
                <Play className="mr-1 h-4 w-4" />
                {addMembers.isPending ? 'Starting...' : `Add & Start (${selectedNewTrainees.length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retake Confirmation Dialog */}
      <Dialog open={retakeDialogOpen} onOpenChange={(open) => {
        setRetakeDialogOpen(open);
        if (!open) setRetakeTargetTrainee(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Allow Retake
            </DialogTitle>
            <DialogDescription>
              This will mark <strong>{retakeTargetTrainee?.userName}</strong>&apos;s current attempt
              (score: {retakeTargetTrainee?.currentScore} pts) as retaken and create a fresh attempt.
              The old attempt will be preserved as history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRetakeDialogOpen(false); setRetakeTargetTrainee(null); }}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={retakeAttempt.isPending}
              onClick={async () => {
                if (!retakeTargetTrainee) return;
                try {
                  await retakeAttempt.mutateAsync(retakeTargetTrainee.attemptId);
                  toast({ title: `Retake started for ${retakeTargetTrainee.userName}` });
                  setRetakeDialogOpen(false);
                  setRetakeTargetTrainee(null);
                  refetch();
                } catch {
                  toast({ title: 'Failed to start retake', variant: 'destructive' });
                }
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {retakeAttempt.isPending ? 'Starting...' : 'Confirm Retake'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Report Dialog */}
      <Dialog open={!!viewReportAttemptId} onOpenChange={(open) => { if (!open) setViewReportAttemptId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trainee Answer Report</DialogTitle>
          </DialogHeader>
          {viewReportAttemptId && <ResultsScreen attemptId={viewReportAttemptId} embedded />}
        </DialogContent>
      </Dialog>

      {/* Broadcast Alert Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={(open) => {
        setAlertDialogOpen(open);
        if (!open) setAlertMessage('');
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Broadcast Alert to All Trainees
            </DialogTitle>
            <DialogDescription>
              This message will appear as an unmissable dialog overlay for every trainee in this session.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            placeholder="Type your alert message..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAlertDialogOpen(false); setAlertMessage(''); }}>
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleBroadcastAlert} disabled={!alertMessage.trim()}>
              <Send className="mr-2 h-4 w-4" /> Send Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
