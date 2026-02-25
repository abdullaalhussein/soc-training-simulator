'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { Lightbulb, AlertCircle, MessageSquare } from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

interface BriefingPanelProps {
  briefing: string;
  stageTitle: string;
  stageDescription: string;
  hints: any[];
  attemptId: string;
  trainerHints: string[];
  onHintUsed: () => void;
}

export function BriefingPanel({ briefing, stageTitle, stageDescription, hints, attemptId, trainerHints, onHintUsed }: BriefingPanelProps) {
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [hintContents, setHintContents] = useState<Record<string, string>>({});

  const requestHint = async (hint: any) => {
    if (revealedHints.has(hint.id)) return;
    try {
      const { data } = await api.post(`/attempts/${attemptId}/hints`, { hintId: hint.id });
      setRevealedHints(prev => new Set([...prev, hint.id]));
      setHintContents(prev => ({ ...prev, [hint.id]: data.content }));
      onHintUsed();
    } catch (err) {
      console.error('Failed to get hint:', err);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm mb-2">Briefing</h3>
          <MarkdownRenderer content={briefing} className="text-sm text-muted-foreground" />
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Current Stage: {stageTitle}</h3>
          </div>
          <MarkdownRenderer content={stageDescription} className="text-sm text-muted-foreground" />
        </div>

        <Separator />

        {hints.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" /> Hints
            </h3>
            <div className="space-y-2">
              {hints.map((hint: any, i: number) => (
                <div key={hint.id}>
                  {revealedHints.has(hint.id) ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2 text-sm">
                      {hintContents[hint.id]}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs"
                      onClick={() => requestHint(hint)}
                    >
                      <Lightbulb className="mr-2 h-3 w-3" />
                      Reveal Hint {i + 1} (-{hint.pointsPenalty} pts)
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {trainerHints.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Trainer Messages
              </h3>
              <div className="space-y-2">
                {trainerHints.map((msg, i) => (
                  <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 text-sm">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
