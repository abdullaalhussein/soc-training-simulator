'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { format } from 'date-fns';

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
  INFO: 'bg-slate-100 text-slate-800',
};

const logTypeColors: Record<string, string> = {
  WINDOWS_EVENT: 'bg-blue-100 text-blue-800',
  SYSMON: 'bg-purple-100 text-purple-800',
  EDR_ALERT: 'bg-red-100 text-red-800',
  NETWORK_FLOW: 'bg-green-100 text-green-800',
  SIEM_ALERT: 'bg-orange-100 text-orange-800',
  FIREWALL: 'bg-yellow-100 text-yellow-800',
  PROXY: 'bg-cyan-100 text-cyan-800',
  DNS: 'bg-indigo-100 text-indigo-800',
  EMAIL_GATEWAY: 'bg-pink-100 text-pink-800',
  AUTH_LOG: 'bg-teal-100 text-teal-800',
};

interface LogTableProps {
  logs: any[];
  pagination: any;
  isLoading: boolean;
  onLogClick: (log: any) => void;
  onAddEvidence: (log: any) => void;
  onAddTimeline: (entry: any) => void;
  onPageChange: (page: number) => void;
}

export function LogTable({ logs, pagination, isLoading, onLogClick, onAddEvidence, onAddTimeline, onPageChange }: LogTableProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <Table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '60px' }} />
            <col style={{ width: '76px' }} />
            <col style={{ width: '62px' }} />
            <col style={{ width: '72px' }} />
            <col />
            <col style={{ width: '52px' }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sev.</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No logs match your filters
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log: any) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/70"
                  onClick={() => onLogClick(log)}
                >
                  <TableCell className="text-xs font-mono whitespace-nowrap">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] whitespace-nowrap ${logTypeColors[log.logType] || ''}`}>
                      {log.logType.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${severityColors[log.severity] || ''}`}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{log.hostname || '-'}</TableCell>
                  <TableCell className="text-sm truncate" title={log.summary}>{log.summary}</TableCell>
                  <TableCell className="p-1">
                    <div className="flex gap-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Add to Evidence"
                        onClick={() => onAddEvidence(log)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Add to Timeline"
                        onClick={() => onAddTimeline({ timestamp: log.timestamp, summary: log.summary, logId: log.id })}
                      >
                        <Clock className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="border-t p-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination.total} logs - Page {pagination.page}/{pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
