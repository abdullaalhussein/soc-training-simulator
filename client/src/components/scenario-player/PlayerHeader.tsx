'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Trophy, CheckCircle } from 'lucide-react';

interface PlayerHeaderProps {
  scenarioName: string;
  currentStage: number;
  totalStages: number;
  stageTitle: string;
  elapsedSeconds: number;
  score: number;
  unansweredCount: number;
  onComplete: () => void;
  onOpenCheckpoints: () => void;
}

export function PlayerHeader({ scenarioName, currentStage, totalStages, stageTitle, elapsedSeconds, score, unansweredCount, onComplete, onOpenCheckpoints }: PlayerHeaderProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const progress = ((currentStage - 1) / totalStages) * 100;

  return (
    <div className="border-b bg-card">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-sm">{scenarioName}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-semibold">Stage {currentStage}/{totalStages}</Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">— {stageTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{score} pts</span>
          </div>
          {unansweredCount > 0 && (
            <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600 animate-pulse" onClick={onOpenCheckpoints}>
              <CheckCircle className="mr-1 h-4 w-4" /> {unansweredCount} Question{unansweredCount > 1 ? 's' : ''} Pending
            </Button>
          )}
          {currentStage >= totalStages && unansweredCount === 0 && (
            <Button size="sm" onClick={onComplete}>
              <CheckCircle className="mr-1 h-4 w-4" /> Submit Investigation
            </Button>
          )}
        </div>
      </div>
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
