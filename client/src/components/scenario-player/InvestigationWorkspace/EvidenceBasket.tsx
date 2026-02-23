'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Minus, Package } from 'lucide-react';

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
        <div key={log.id} className="border rounded-md p-2 text-sm hover:bg-muted/50 overflow-hidden">
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{log.logType}</Badge>
            <Badge variant="outline" className="text-xs">{log.severity}</Badge>
          </div>
          <p className="text-xs truncate mb-1.5">{log.summary}</p>
          {log.hostname && (
            <p className="text-xs text-muted-foreground mb-1.5">{log.hostname}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(log.id)}
          >
            <Minus className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Remove</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
