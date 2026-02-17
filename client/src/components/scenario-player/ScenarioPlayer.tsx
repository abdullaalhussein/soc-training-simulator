'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { PlayerHeader } from './PlayerHeader';
import { BriefingPanel } from './BriefingPanel';
import { LogFeedViewer } from './LogFeedViewer/LogFeedViewer';
import { InvestigationWorkspace } from './InvestigationWorkspace/InvestigationWorkspace';
import { CheckpointModal } from './CheckpointModal/CheckpointModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/hooks/useMobile';
import { getTraineeSocket } from '@/lib/socket';
import { FileText, MessageCircle } from 'lucide-react';
import { DiscussionPanel } from '@/components/DiscussionPanel';

interface ScenarioPlayerProps {
  attemptId: string;
  sessionId?: string;
}

export function ScenarioPlayer({ attemptId, sessionId }: ScenarioPlayerProps) {
  const queryClient = useQueryClient();
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trainerHints, setTrainerHints] = useState<string[]>([]);
  const [localAnsweredIds, setLocalAnsweredIds] = useState<Set<string>>(new Set());
  const [briefingSheetOpen, setBriefingSheetOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);

  const isMobile = useMobile();
  const isTablet = useMobile(1024);

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: async () => {
      const { data } = await api.get(`/attempts/${attemptId}`);
      return data;
    },
  });

  // Timer
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;
    const start = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt]);

  // Socket for real-time hints from trainer
  useEffect(() => {
    const socket = getTraineeSocket();
    socket.auth = { token: localStorage.getItem('token') };
    socket.connect();
    socket.emit('join-attempt', attemptId);
    if (sessionId) {
      socket.emit('join-session', sessionId);
    }

    socket.on('hint-sent', (data: { content: string }) => {
      setTrainerHints(prev => [...prev, data.content]);
    });

    socket.on('session-paused', () => {
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    });

    return () => {
      socket.off('hint-sent');
      socket.off('session-paused');
      socket.disconnect();
    };
  }, [attemptId, sessionId, queryClient]);

  const trackAction = useCallback(async (actionType: string, details?: any) => {
    try {
      await api.post(`/attempts/${attemptId}/actions`, { actionType, details });
      const socket = getTraineeSocket();
      socket.emit('progress-update', {
        attemptId,
        sessionId: attempt?.sessionId,
        userId: attempt?.userId,
        currentStage: attempt?.currentStage,
        lastAction: actionType,
        details,
        currentScore: attempt?.totalScore,
        elapsedMinutes: Math.floor(elapsedSeconds / 60),
      });
    } catch { /* fire and forget */ }
  }, [attemptId, attempt, elapsedSeconds]);

  const addEvidence = useCallback((log: any) => {
    if (!evidence.find(e => e.id === log.id)) {
      setEvidence(prev => [...prev, log]);
      trackAction('EVIDENCE_ADDED', { logId: log.id, summary: log.summary });
    }
  }, [evidence, trackAction]);

  const removeEvidence = useCallback((logId: string) => {
    setEvidence(prev => prev.filter(e => e.id !== logId));
    trackAction('EVIDENCE_REMOVED', { logId });
  }, [trackAction]);

  const addTimelineEntry = useCallback((entry: any) => {
    setTimelineEntries(prev => [...prev, { ...entry, id: Date.now().toString() }]);
    trackAction('TIMELINE_ENTRY_ADDED', entry);
  }, [trackAction]);

  const removeTimelineEntry = useCallback((entryId: string) => {
    setTimelineEntries(prev => prev.filter(e => e.id !== entryId));
    trackAction('TIMELINE_ENTRY_REMOVED', { entryId });
  }, [trackAction]);

  const handleStageComplete = () => {
    setShowCheckpoint(true);
  };

  const handleCheckpointComplete = async () => {
    setShowCheckpoint(false);
    queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    try {
      await api.post(`/attempts/${attemptId}/advance-stage`);
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    } catch { /* may be last stage or still has unanswered checkpoints */ }
  };

  const handleComplete = async () => {
    try {
      await api.post(`/attempts/${attemptId}/complete`);
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    } catch (err) {
      console.error('Failed to complete:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 w-96">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground">Attempt not found</div>;
  }

  const scenario = attempt.session?.scenario;
  const stages = scenario?.stages || [];
  const currentStageData = stages.find((s: any) => s.stageNumber === attempt.currentStage);
  const checkpoints = scenario?.checkpoints?.filter((c: any) => c.stageNumber === attempt.currentStage) || [];
  const serverAnsweredIds = new Set(attempt.answers?.map((a: any) => a.checkpointId) || []);
  const unansweredCheckpoints = checkpoints.filter(
    (c: any) => !serverAnsweredIds.has(c.id) && !localAnsweredIds.has(c.id)
  );

  if (attempt.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold">Investigation Complete</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-primary">{attempt.totalScore}</p>
              <p className="text-sm text-muted-foreground">Total Score</p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{attempt.accuracyScore}</p>
              <p className="text-sm text-muted-foreground">Accuracy (/35)</p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{attempt.investigationScore}</p>
              <p className="text-sm text-muted-foreground">Investigation (/20)</p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{attempt.evidenceScore}</p>
              <p className="text-sm text-muted-foreground">Evidence (/20)</p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{attempt.responseScore}</p>
              <p className="text-sm text-muted-foreground">Response (/15)</p>
            </div>
            <div className="bg-card border rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{attempt.reportScore}</p>
              <p className="text-sm text-muted-foreground">Report (/10)</p>
            </div>
          </div>
          {attempt.hintPenalty > 0 && (
            <p className="text-sm text-destructive">Hint Penalty: -{attempt.hintPenalty} points ({attempt.hintsUsed} hints used)</p>
          )}
          {attempt.notes?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Trainer Notes</h3>
              {attempt.notes.map((n: any) => (
                <div key={n.id} className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium">{n.trainer?.name}</p>
                  <p>{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const briefingProps = {
    briefing: scenario?.briefing || '',
    stageTitle: currentStageData?.title || '',
    stageDescription: currentStageData?.description || '',
    hints: currentStageData?.hints || [],
    attemptId,
    trainerHints,
    onHintUsed: () => queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] }),
  };

  const logProps = {
    attemptId,
    onTrackAction: trackAction,
    onAddEvidence: addEvidence,
    onAddTimeline: addTimelineEntry,
  };

  const workspaceProps = {
    evidence,
    timelineEntries,
    onRemoveEvidence: removeEvidence,
    onRemoveTimeline: removeTimelineEntry,
    onStageComplete: handleStageComplete,
    hasUnansweredCheckpoints: unansweredCheckpoints.length > 0,
    unansweredCount: unansweredCheckpoints.length,
    currentStage: attempt.currentStage,
    totalStages: stages.length,
    stageTitle: currentStageData?.title || '',
  };

  const headerProps = {
    scenarioName: scenario?.name || '',
    currentStage: attempt.currentStage,
    totalStages: stages.length,
    stageTitle: currentStageData?.title || '',
    elapsedSeconds,
    score: attempt.totalScore,
    unansweredCount: unansweredCheckpoints.length,
    onComplete: handleComplete,
    onOpenCheckpoints: handleStageComplete,
  };

  const checkpointModal = showCheckpoint && unansweredCheckpoints.length > 0 && (
    <CheckpointModal
      checkpoints={unansweredCheckpoints}
      attemptId={attemptId}
      onComplete={handleCheckpointComplete}
      onClose={() => {
        setShowCheckpoint(false);
        queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
      }}
      onAnswered={(checkpointId) => {
        setLocalAnsweredIds(prev => new Set(prev).add(checkpointId));
      }}
    />
  );

  // Mobile layout: tabbed interface
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <PlayerHeader {...headerProps} />
        <Tabs defaultValue="logs" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b shrink-0">
            <TabsTrigger value="brief" className="flex-1">Brief</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
            <TabsTrigger value="work" className="flex-1">Work</TabsTrigger>
            {sessionId && <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>}
          </TabsList>
          <TabsContent value="brief" className="flex-1 overflow-y-auto mt-0">
            <BriefingPanel {...briefingProps} />
          </TabsContent>
          <TabsContent value="logs" className="flex-1 overflow-hidden mt-0">
            <LogFeedViewer {...logProps} />
          </TabsContent>
          <TabsContent value="work" className="flex-1 overflow-y-auto mt-0">
            <InvestigationWorkspace {...workspaceProps} />
          </TabsContent>
          {sessionId && (
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <DiscussionPanel sessionId={sessionId} />
            </TabsContent>
          )}
        </Tabs>
        {checkpointModal}
      </div>
    );
  }

  // Tablet layout: briefing in sheet, logs + workspace side by side
  if (isTablet) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <PlayerHeader {...headerProps} />
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 min-w-0 overflow-hidden">
            <LogFeedViewer {...logProps} />
          </div>
          <div className="w-72 flex-shrink-0 border-l overflow-y-auto">
            <InvestigationWorkspace {...workspaceProps} />
          </div>
          <div className="absolute bottom-4 left-4 z-10 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="shadow-md"
              onClick={() => setBriefingSheetOpen(true)}
            >
              <FileText className="mr-1 h-4 w-4" /> Briefing
            </Button>
            {sessionId && (
              <Button
                size="sm"
                variant="outline"
                className="shadow-md"
                onClick={() => setChatSheetOpen(true)}
              >
                <MessageCircle className="mr-1 h-4 w-4" /> Chat
              </Button>
            )}
          </div>
          <Sheet open={briefingSheetOpen} onOpenChange={setBriefingSheetOpen}>
            <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle>Briefing</SheetTitle>
              </SheetHeader>
              <BriefingPanel {...briefingProps} />
            </SheetContent>
          </Sheet>
          {sessionId && (
            <Sheet open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
              <SheetContent side="right" className="w-80 p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b">
                  <SheetTitle>Discussion</SheetTitle>
                </SheetHeader>
                <DiscussionPanel sessionId={sessionId} />
              </SheetContent>
            </Sheet>
          )}
        </div>
        {checkpointModal}
      </div>
    );
  }

  // Desktop layout: 3-panel with chat button
  return (
    <div className="h-screen flex flex-col bg-background">
      <PlayerHeader {...headerProps} />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-64 flex-shrink-0 border-r overflow-y-auto">
          <BriefingPanel {...briefingProps} />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <LogFeedViewer {...logProps} />
        </div>
        <div className="w-72 flex-shrink-0 border-l overflow-y-auto">
          <InvestigationWorkspace {...workspaceProps} />
        </div>
        {sessionId && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="absolute bottom-4 right-[19rem] z-10 shadow-md"
              onClick={() => setChatSheetOpen(true)}
            >
              <MessageCircle className="mr-1 h-4 w-4" /> Chat
            </Button>
            <Sheet open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
              <SheetContent side="right" className="w-80 p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b">
                  <SheetTitle>Discussion</SheetTitle>
                </SheetHeader>
                <DiscussionPanel sessionId={sessionId} />
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
      {checkpointModal}
    </div>
  );
}
