'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession, useUpdateSessionStatus } from '@/hooks/useSessions';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api';
import { getTrainerSocket } from '@/lib/socket';
import { Play, Pause, Square, Send, Eye, Users, Activity, MessageSquare } from 'lucide-react';

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
  actions: { type: string; time: string }[];
}

export default function SessionMonitorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { data: session, refetch } = useSession(sessionId);
  const updateStatus = useUpdateSessionStatus();

  const [trainees, setTrainees] = useState<Map<string, TraineeState>>(new Map());
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [hintDialogOpen, setHintDialogOpen] = useState(false);
  const [hintContent, setHintContent] = useState('');

  // Initialize trainee states from session data
  useEffect(() => {
    if (session?.attempts) {
      const map = new Map<string, TraineeState>();
      for (const attempt of session.attempts) {
        map.set(attempt.userId, {
          attemptId: attempt.id,
          userId: attempt.userId,
          userName: attempt.user?.name || 'Unknown',
          currentStage: attempt.currentStage,
          totalStages: session.scenario?.stages?.length || 0,
          currentScore: attempt.totalScore,
          lastAction: '',
          elapsedMinutes: attempt.startedAt
            ? Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 60000)
            : 0,
          status: attempt.status,
          actions: [],
        });
      }
      setTrainees(map);
    }
  }, [session]);

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
          updated.set(data.userId, {
            ...existing,
            currentStage: data.currentStage || existing.currentStage,
            currentScore: data.currentScore || existing.currentScore,
            lastAction: data.lastAction || existing.lastAction,
            elapsedMinutes: data.elapsedMinutes || existing.elapsedMinutes,
            actions: [
              { type: data.lastAction, time: new Date().toLocaleTimeString() },
              ...existing.actions.slice(0, 49),
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
      await api.post(`/attempts/${trainee.attemptId}/actions`, {
        actionType: 'HINT_REQUESTED',
        details: { trainerHint: hintContent, fromTrainer: true },
      });

      // Emit hint to trainee via socket
      const socket = getTrainerSocket();
      socket.emit('send-hint', {
        attemptId: trainee.attemptId,
        content: hintContent,
      });

      toast({ title: 'Hint sent' });
      setHintDialogOpen(false);
      setHintContent('');
    } catch {
      toast({ title: 'Failed to send hint', variant: 'destructive' });
    }
  };

  const selectedTraineeData = selectedTrainee ? trainees.get(selectedTrainee) : null;
  const traineeList = Array.from(trainees.values());

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
                <div className="flex gap-4 text-sm">
                  <Badge variant="outline">Stage {selectedTraineeData.currentStage}/{selectedTraineeData.totalStages}</Badge>
                  <Badge variant="outline">{selectedTraineeData.currentScore} points</Badge>
                  <Badge variant="outline">{selectedTraineeData.elapsedMinutes} min</Badge>
                  <Badge variant="outline">{selectedTraineeData.status}</Badge>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="flex-1 overflow-hidden pt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Live Activity Feed
                </h4>
                <ScrollArea className="h-[calc(100%-2rem)]">
                  <div className="space-y-1">
                    {selectedTraineeData.actions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Waiting for activity...</p>
                    ) : (
                      selectedTraineeData.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm py-1">
                          <span className="text-xs text-muted-foreground font-mono w-16">{action.time}</span>
                          <Badge variant="outline" className="text-xs">{action.type.replace('_', ' ')}</Badge>
                        </div>
                      ))
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

      <Dialog open={hintDialogOpen} onOpenChange={setHintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Hint to {selectedTraineeData?.userName}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={hintContent}
            onChange={(e) => setHintContent(e.target.value)}
            placeholder="Type your hint or guidance..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHintDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendHint}>
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
