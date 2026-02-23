'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Trash2, Package } from 'lucide-react';

interface EvidenceBasketProps {
  evidence: any[];
  onRemove: (logId: string) => void;
}

export function EvidenceBasket({ evidence, onRemove }: EvidenceBasketProps) {
  if (evidence.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No evidence collected yet.</p>
        <p className="text-xs mt-1">Click the + icon on logs to flag them as evidence.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {evidence.map((log, index) => (
        <div key={log.id} className="border rounded-lg bg-card shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
              <Badge className="text-[10px]" variant="outline">{log.logType?.replace('_', ' ')}</Badge>
              <Badge className="text-[10px]" variant="outline">{log.severity}</Badge>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              title="Remove from Evidence"
              onClick={() => onRemove(log.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="px-3 pb-2.5 space-y-1">
            <p className="text-xs leading-relaxed">{log.summary}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {log.hostname && <span>{log.hostname}</span>}
              {log.hostname && log.timestamp && <span>·</span>}
              {log.timestamp && <span>{format(new Date(log.timestamp), 'HH:mm:ss')}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
