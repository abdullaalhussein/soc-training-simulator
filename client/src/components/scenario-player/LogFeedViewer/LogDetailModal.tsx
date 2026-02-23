'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Plus, Minus } from 'lucide-react';

interface LogDetailModalProps {
  log: any;
  isEvidence?: boolean;
  onClose: () => void;
  onAddEvidence: (log: any) => void;
  onRemoveEvidence?: (logId: string) => void;
}

export function LogDetailModal({ log, isEvidence, onClose, onAddEvidence, onRemoveEvidence }: LogDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Log Detail
            <Badge variant="outline">{log.logType}</Badge>
            <Badge variant="outline">{log.severity}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm">{log.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {log.hostname && <div><span className="font-medium">Hostname:</span> {log.hostname}</div>}
            {log.username && <div><span className="font-medium">Username:</span> {log.username}</div>}
            {log.processName && <div><span className="font-medium">Process:</span> {log.processName}</div>}
            {log.eventId && <div><span className="font-medium">Event ID:</span> {log.eventId}</div>}
            {log.sourceIp && <div><span className="font-medium">Source IP:</span> {log.sourceIp}</div>}
            {log.destIp && <div><span className="font-medium">Dest IP:</span> {log.destIp}</div>}
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Raw Log (JSON)</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-48">
              {JSON.stringify(log.rawLog, null, 2)}
            </pre>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {isEvidence ? (
            <Button variant="destructive" onClick={() => { onRemoveEvidence?.(log.id); onClose(); }}>
              <Minus className="mr-2 h-4 w-4" /> Remove from Evidence
            </Button>
          ) : (
            <Button onClick={() => { onAddEvidence(log); onClose(); }}>
              <Plus className="mr-2 h-4 w-4" /> Add to Evidence
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
