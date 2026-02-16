'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Package } from 'lucide-react';

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
    <div className="space-y-2">
      {evidence.map((log) => (
        <div key={log.id} className="border rounded-md p-2 text-sm group hover:bg-muted/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <Badge variant="outline" className="text-xs">{log.logType}</Badge>
                <Badge variant="outline" className="text-xs">{log.severity}</Badge>
              </div>
              <p className="text-xs truncate">{log.summary}</p>
              {log.hostname && (
                <p className="text-xs text-muted-foreground mt-0.5">{log.hostname}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(log.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
