'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineBuilder } from './TimelineBuilder';
import { EvidenceBasket } from './EvidenceBasket';
import { Clock, Package, ArrowRight, AlertCircle } from 'lucide-react';

interface InvestigationWorkspaceProps {
  evidence: any[];
  timelineEntries: any[];
  onRemoveEvidence: (logId: string) => void;
  onRemoveTimeline: (entryId: string) => void;
  onStageComplete: () => void;
  hasUnansweredCheckpoints: boolean;
  unansweredCount: number;
  currentStage: number;
  totalStages: number;
  stageTitle: string;
}

export function InvestigationWorkspace({
  evidence, timelineEntries, onRemoveEvidence, onRemoveTimeline,
  onStageComplete, hasUnansweredCheckpoints, unansweredCount, currentStage, totalStages, stageTitle,
}: InvestigationWorkspaceProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <h3 className="font-semibold text-sm">Investigation Workspace</h3>
        <div className="bg-muted/50 rounded-md p-2">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="text-[10px]">Stage {currentStage}/{totalStages}</Badge>
            <span className="text-muted-foreground truncate">{stageTitle}</span>
          </div>
          <div className="flex gap-0.5 mt-1.5">
            {Array.from({ length: totalStages }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < currentStage ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      <Tabs defaultValue="evidence" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="evidence" className="text-xs">
            Evidence <Badge variant="secondary" className="ml-1 text-xs">{evidence.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline <Badge variant="secondary" className="ml-1 text-xs">{timelineEntries.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              <EvidenceBasket evidence={evidence} onRemove={onRemoveEvidence} />
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="timeline" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              <TimelineBuilder entries={timelineEntries} onRemove={onRemoveTimeline} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      {hasUnansweredCheckpoints && (
        <div className="p-3 border-t bg-orange-50">
          <div className="flex items-center gap-2 mb-2 text-xs text-orange-700">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{unansweredCount} checkpoint question{unansweredCount > 1 ? 's' : ''} to answer for this stage</span>
          </div>
          <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={onStageComplete}>
            <ArrowRight className="mr-2 h-4 w-4" /> Answer Checkpoint Questions
          </Button>
        </div>
      )}
    </div>
  );
}
