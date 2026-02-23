'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Minus, Clock } from 'lucide-react';

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
    <div className="space-y-2">
      {sorted.map((entry) => (
        <div key={entry.id} className="border rounded-md p-2 text-sm hover:bg-muted/50 overflow-hidden">
          <Badge variant="outline" className="text-xs mb-1">
            {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
          </Badge>
          <p className="text-xs truncate mb-1.5">{entry.summary}</p>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(entry.id)}
          >
            <Minus className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Remove</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
