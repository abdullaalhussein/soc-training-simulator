'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LogSearchBar } from './LogSearchBar';
import { LogFilterPanel } from './LogFilterPanel';
import { LogTable } from './LogTable';
import { LogDetailModal } from './LogDetailModal';

interface LogFeedViewerProps {
  attemptId: string;
  stageNumber?: number;
  evidence?: any[];
  timelineEntries?: any[];
  onTrackAction: (type: string, details?: any) => void;
  onAddEvidence: (log: any) => void;
  onRemoveEvidence?: (logId: string) => void;
  onAddTimeline: (entry: any) => void;
}

export function LogFeedViewer({ attemptId, stageNumber, evidence, timelineEntries, onTrackAction, onAddEvidence, onRemoveEvidence, onAddTimeline }: LogFeedViewerProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const evidenceIds = new Set(evidence?.map((e: any) => e.id) || []);
  const timelineLogIds = new Set(timelineEntries?.map((e: any) => e.logId).filter(Boolean) || []);

  const { data, isLoading } = useQuery({
    queryKey: ['logs', attemptId, filters, search, page, stageNumber],
    queryFn: async () => {
      const params: any = { ...filters, page: String(page), pageSize: '50' };
      if (search) params.search = search;
      if (stageNumber !== undefined) params.stageNumber = String(stageNumber);
      const { data } = await api.get(`/logs/attempt/${attemptId}`, { params });
      return data;
    },
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['log-filters', attemptId, stageNumber],
    queryFn: async () => {
      const params: any = {};
      if (stageNumber !== undefined) params.stageNumber = String(stageNumber);
      const { data } = await api.get(`/logs/attempt/${attemptId}/filters`, { params });
      return data;
    },
  });

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
    if (query) onTrackAction('SEARCH_QUERY', { query });
  }, [onTrackAction]);

  const handleFilter = useCallback((key: string, value: string) => {
    setFilters(prev => {
      const updated = { ...prev };
      if (value) updated[key] = value;
      else delete updated[key];
      return updated;
    });
    setPage(1);
    onTrackAction('FILTER_APPLIED', { [key]: value });
  }, [onTrackAction]);

  const handleLogClick = useCallback((log: any) => {
    setSelectedLog(log);
    onTrackAction('LOG_OPENED', { logId: log.id, summary: log.summary });
  }, [onTrackAction]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 space-y-2">
        <LogSearchBar onSearch={handleSearch} />
        <LogFilterPanel
          filters={filters}
          filterOptions={filterOptions}
          onFilter={handleFilter}
        />
      </div>
      <div className="flex-1 min-h-0">
        <LogTable
          logs={data?.logs || []}
          pagination={data?.pagination}
          isLoading={isLoading}
          evidenceIds={evidenceIds}
          timelineLogIds={timelineLogIds}
          onLogClick={handleLogClick}
          onAddEvidence={onAddEvidence}
          onAddTimeline={onAddTimeline}
          onPageChange={setPage}
        />
      </div>
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          isEvidence={evidenceIds.has(selectedLog.id)}
          onClose={() => setSelectedLog(null)}
          onAddEvidence={onAddEvidence}
          onRemoveEvidence={onRemoveEvidence}
        />
      )}
    </div>
  );
}
