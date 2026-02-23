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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/hooks/useMobile';
import { getTraineeSocket } from '@/lib/socket';
import { FileText, MessageCircle, AlertTriangle, Sparkles, Lock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ResultsScreen } from './ResultsScreen';
import { OnboardingGuide } from './OnboardingGuide';

interface ScenarioPlayerProps {
  attemptId: string;
  sessionId?: string;
}

export function ScenarioPlayer({ attemptId, sessionId }: ScenarioPlayerProps) {
  const queryClient = useQueryClient();
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [stateRestored, setStateRestored] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trainerHints, setTrainerHints] = useState<string[]>([]);
  const [localAnsweredIds, setLocalAnsweredIds] = useState<Set<string>>(new Set());
  const [briefingSheetOpen, setBriefingSheetOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [trainerAlert, setTrainerAlert] = useState<string | null>(null);
  const [viewingStage, setViewingStage] = useState<number | null>(null);

  const isMobile = useMobile();
  const isTablet = useMobile(1024);

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: async () => {
      const { data } = await api.get(`/attempts/${attemptId}`);
      return data;
    },
  });

  // Restore saved evidence and timeline from server
  useEffect(() => {
    if (!attempt || stateRestored) return;
    if (attempt.savedEvidence?.length > 0) {
      setEvidence(attempt.savedEvidence);
    }
    if (attempt.savedTimeline?.length > 0) {
      setTimelineEntries(attempt.savedTimeline);
    }
    setStateRestored(true);
  }, [attempt, stateRestored]);

  // Sync viewingStage when currentStage advances
  useEffect(() => {
    if (attempt?.currentStage) {
      setViewingStage(attempt.currentStage);
    }
  }, [attempt?.currentStage]);

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

    socket.on('session-alert', (data: { message: string }) => {
      setTrainerAlert(data.message);
    });

    return () => {
      socket.off('hint-sent');
      socket.off('session-paused');
      socket.off('session-alert');
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
    setEvidence(prev => {
      if (prev.find(e => e.id === log.id)) return prev;
      return [...prev, log];
    });
    trackAction('EVIDENCE_ADDED', { logId: log.id, summary: log.summary });
  }, [trackAction]);

  const removeEvidence = useCallback((logId: string) => {
    setEvidence(prev => prev.filter(e => e.id !== logId));
    trackAction('EVIDENCE_REMOVED', { logId });
  }, [trackAction]);

  const addTimelineEntry = useCallback((entry: any) => {
    setTimelineEntries(prev => {
      if (entry.logId && prev.find(e => e.logId === entry.logId)) return prev;
      return [...prev, { ...entry, id: Date.now().toString() }];
    });
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

  const handleAdvanceStage = async () => {
    try {
      await api.post(`/attempts/${attemptId}/advance-stage`);
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    } catch (err) {
      console.error('Failed to advance stage:', err);
    }
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
  const activeViewingStage = viewingStage ?? attempt.currentStage;
  const viewingStageData = stages.find((s: any) => s.stageNumber === activeViewingStage);
  const isViewingCurrentStage = activeViewingStage === attempt.currentStage;
  const checkpoints = scenario?.checkpoints?.filter((c: any) => c.stageNumber === attempt.currentStage) || [];
  const serverAnsweredIds = new Set(attempt.answers?.map((a: any) => a.checkpointId) || []);
  const unansweredCheckpoints = checkpoints.filter(
    (c: any) => !serverAnsweredIds.has(c.id) && !localAnsweredIds.has(c.id)
  );

  if (attempt.status === 'COMPLETED') {
    return <ResultsScreen attemptId={attemptId} />;
  }

  const briefingProps = {
    briefing: scenario?.briefing || '',
    stageTitle: viewingStageData?.title || '',
    stageDescription: viewingStageData?.description || '',
    hints: viewingStageData?.hints || [],
    attemptId,
    trainerHints: isViewingCurrentStage ? trainerHints : [],
    onHintUsed: () => queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] }),
  };

  const logProps = {
    attemptId,
    stageNumber: activeViewingStage,
    evidence,
    timelineEntries,
    onTrackAction: trackAction,
    onAddEvidence: addEvidence,
    onRemoveEvidence: removeEvidence,
    onAddTimeline: addTimelineEntry,
  };

  const workspaceProps = {
    evidence,
    timelineEntries,
    onRemoveEvidence: removeEvidence,
    onRemoveTimeline: removeTimelineEntry,
    onStageComplete: handleStageComplete,
    onAdvanceStage: handleAdvanceStage,
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
    onAdvanceStage: handleAdvanceStage,
  };

  const stageSelector = stages.length > 1 && (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 overflow-x-auto">
      {stages.map((s: any) => {
        const isUnlocked = s.stageNumber <= attempt.currentStage;
        const isActive = s.stageNumber === activeViewingStage;
        const isCurrent = s.stageNumber === attempt.currentStage;
        return (
          <button
            key={s.stageNumber}
            disabled={!isUnlocked}
            onClick={() => setViewingStage(s.stageNumber)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : isUnlocked
                  ? 'bg-background border hover:bg-accent cursor-pointer'
                  : 'text-muted-foreground/50 cursor-not-allowed',
            )}
          >
            {!isUnlocked && <Lock className="h-3 w-3" />}
            <span>Stage {s.stageNumber}</span>
            {isCurrent && isUnlocked && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </button>
        );
      })}
    </div>
  );

  const viewingPastStageBanner = !isViewingCurrentStage && (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center justify-between">
      <p className="text-xs text-amber-800 dark:text-amber-400">
        Viewing Stage {activeViewingStage}: {viewingStageData?.title}
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs text-amber-800 dark:text-amber-400"
        onClick={() => setViewingStage(attempt.currentStage)}
      >
        Back to current stage <ChevronRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );

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

  const trainerAlertDialog = trainerAlert !== null && (
    <Dialog open={true} onOpenChange={() => setTrainerAlert(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Message from Trainer
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{trainerAlert}</p>
        <DialogFooter>
          <Button onClick={() => setTrainerAlert(null)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Mobile layout: tabbed interface
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <PlayerHeader {...headerProps} />
        {stageSelector}
        {viewingPastStageBanner}
        <Tabs defaultValue="logs" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b shrink-0">
            <TabsTrigger value="brief" className="flex-1">Brief</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
            <TabsTrigger value="work" className="flex-1">Work</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">AI</TabsTrigger>
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
          <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
            <AiAssistantPanel attemptId={attemptId} />
          </TabsContent>
          {sessionId && (
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <DiscussionPanel sessionId={sessionId} />
            </TabsContent>
          )}
        </Tabs>
        {checkpointModal}
        {trainerAlertDialog}
        <OnboardingGuide />
      </div>
    );
  }

  // Tablet layout: briefing in sheet, logs + workspace side by side
  if (isTablet) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <PlayerHeader {...headerProps} />
        {stageSelector}
        {viewingPastStageBanner}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 min-w-0 overflow-hidden">
            <LogFeedViewer {...logProps} />
          </div>
          <div className="w-72 flex-shrink-0 border-l overflow-y-auto overflow-x-hidden">
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
            <Button
              size="sm"
              variant="outline"
              className="shadow-md"
              onClick={() => setAiSheetOpen(true)}
            >
              <Sparkles className="mr-1 h-4 w-4" /> AI Help
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
          <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
            <SheetContent side="right" className="w-80 p-0 flex flex-col">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle>AI Assistant</SheetTitle>
              </SheetHeader>
              <AiAssistantPanel attemptId={attemptId} />
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
        {trainerAlertDialog}
        <OnboardingGuide />
      </div>
    );
  }

  // Desktop layout: 3-panel with chat button
  return (
    <div className="h-screen flex flex-col bg-background">
      <PlayerHeader {...headerProps} />
      {stageSelector}
      {viewingPastStageBanner}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-64 flex-shrink-0 border-r overflow-y-auto">
          <BriefingPanel {...briefingProps} />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <LogFeedViewer {...logProps} />
        </div>
        <div className="w-72 flex-shrink-0 border-l overflow-y-auto overflow-x-hidden">
          <InvestigationWorkspace {...workspaceProps} />
        </div>
        <div className="absolute bottom-4 right-[19rem] z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="shadow-md"
            onClick={() => setAiSheetOpen(true)}
          >
            <Sparkles className="mr-1 h-4 w-4" /> AI Help
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
        <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
          <SheetContent side="right" className="w-80 p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>AI Assistant</SheetTitle>
            </SheetHeader>
            <AiAssistantPanel attemptId={attemptId} />
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
      {trainerAlertDialog}
      <OnboardingGuide />
    </div>
  );
}
