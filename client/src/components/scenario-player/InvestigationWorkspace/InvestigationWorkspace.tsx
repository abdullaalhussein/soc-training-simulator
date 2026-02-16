'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineBuilder } from './TimelineBuilder';
import { EvidenceBasket } from './EvidenceBasket';
import { Clock, Package, ArrowRight } from 'lucide-react';

interface InvestigationWorkspaceProps {
  evidence: any[];
  timelineEntries: any[];
  onRemoveEvidence: (logId: string) => void;
  onRemoveTimeline: (entryId: string) => void;
  onStageComplete: () => void;
  hasUnansweredCheckpoints: boolean;
}

export function InvestigationWorkspace({
  evidence, timelineEntries, onRemoveEvidence, onRemoveTimeline,
  onStageComplete, hasUnansweredCheckpoints,
}: InvestigationWorkspaceProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Investigation Workspace</h3>
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
        <div className="p-3 border-t">
          <Button className="w-full" onClick={onStageComplete}>
            <ArrowRight className="mr-2 h-4 w-4" /> Answer Checkpoint Questions
          </Button>
        </div>
      )}
    </div>
  );
}
