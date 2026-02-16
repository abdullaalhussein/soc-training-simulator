'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Trophy, CheckCircle } from 'lucide-react';

interface PlayerHeaderProps {
  scenarioName: string;
  currentStage: number;
  totalStages: number;
  elapsedSeconds: number;
  score: number;
  onComplete: () => void;
}

export function PlayerHeader({ scenarioName, currentStage, totalStages, elapsedSeconds, score, onComplete }: PlayerHeaderProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="font-semibold text-sm">{scenarioName}</h1>
        <Badge variant="outline">Stage {currentStage}/{totalStages}</Badge>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-semibold">{score} pts</span>
        </div>
        {currentStage >= totalStages && (
          <Button size="sm" onClick={onComplete}>
            <CheckCircle className="mr-1 h-4 w-4" /> Submit Investigation
          </Button>
        )}
      </div>
    </div>
  );
}
