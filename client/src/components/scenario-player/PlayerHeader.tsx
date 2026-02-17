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
      <div className="min-h-[3.5rem] flex flex-wrap items-center justify-between px-4 py-2 gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <h1 className="font-semibold text-sm truncate">{scenarioName}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-semibold text-xs">Stage {currentStage}/{totalStages}</Badge>
            <span className="text-xs text-muted-foreground hidden lg:inline">— {stageTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 text-xs md:text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-1 text-xs md:text-sm">
            <Trophy className="h-3.5 w-3.5 text-yellow-500" />
            <span className="font-semibold">{score}</span>
          </div>
          {unansweredCount > 0 && (
            <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600 animate-pulse text-xs" onClick={onOpenCheckpoints}>
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{unansweredCount} Pending</span>
              <span className="sm:hidden">{unansweredCount}</span>
            </Button>
          )}
          {currentStage >= totalStages && unansweredCount === 0 && (
            <Button size="sm" onClick={onComplete} className="text-xs">
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Submit Investigation</span>
              <span className="sm:hidden">Submit</span>
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
