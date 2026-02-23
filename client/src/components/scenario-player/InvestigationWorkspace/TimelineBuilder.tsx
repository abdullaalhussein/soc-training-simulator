'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Trash2, Clock } from 'lucide-react';

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
    <div className="relative pl-4">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-3">
        {sorted.map((entry, index) => (
          <div key={entry.id} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-4 top-2.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background shadow-sm" />

            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
              <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Remove from Timeline"
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="px-3 pb-2.5">
                <p className="text-xs leading-relaxed">{entry.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
