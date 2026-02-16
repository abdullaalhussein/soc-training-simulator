'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { X, Clock } from 'lucide-react';

interface TimelineBuilderProps {
  entries: any[];
  onRemove: (entryId: string) => void;
}

export function TimelineBuilder({ entries, onRemove }: TimelineBuilderProps) {
  const sorted = [...entries].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (entries.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No timeline entries yet.</p>
        <p className="text-xs mt-1">Click the clock icon on logs to build your timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            {i < sorted.length - 1 && <div className="w-0.5 flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-mono text-muted-foreground">
                  {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </p>
                <p className="text-sm mt-0.5">{entry.summary}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onRemove(entry.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
