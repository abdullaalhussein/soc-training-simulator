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
  onTrackAction: (type: string, details?: any) => void;
  onAddEvidence: (log: any) => void;
  onAddTimeline: (entry: any) => void;
}

export function LogFeedViewer({ attemptId, onTrackAction, onAddEvidence, onAddTimeline }: LogFeedViewerProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['logs', attemptId, filters, search, page],
    queryFn: async () => {
      const params: any = { ...filters, page: String(page), pageSize: '50' };
      if (search) params.search = search;
      const { data } = await api.get(`/logs/attempt/${attemptId}`, { params });
      return data;
    },
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['log-filters', attemptId],
    queryFn: async () => {
      const { data } = await api.get(`/logs/attempt/${attemptId}/filters`);
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
      <div className="flex-1 overflow-hidden">
        <LogTable
          logs={data?.logs || []}
          pagination={data?.pagination}
          isLoading={isLoading}
          onLogClick={handleLogClick}
          onAddEvidence={onAddEvidence}
          onAddTimeline={onAddTimeline}
          onPageChange={setPage}
        />
      </div>
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onAddEvidence={onAddEvidence}
        />
      )}
    </div>
  );
}
