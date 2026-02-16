'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LogFilterPanelProps {
  filters: Record<string, string>;
  filterOptions: any;
  onFilter: (key: string, value: string) => void;
}

export function LogFilterPanel({ filters, filterOptions, onFilter }: LogFilterPanelProps) {
  const filterConfigs = [
    { key: 'logType', label: 'Log Type', options: filterOptions?.logTypes || [] },
    { key: 'hostname', label: 'Hostname', options: filterOptions?.hostnames || [] },
    { key: 'username', label: 'Username', options: filterOptions?.usernames || [] },
    { key: 'processName', label: 'Process', options: filterOptions?.processNames || [] },
    { key: 'sourceIp', label: 'Source IP', options: filterOptions?.sourceIps || [] },
    { key: 'destIp', label: 'Dest IP', options: filterOptions?.destIps || [] },
  ];

  const activeFilters = Object.entries(filters).filter(([_, v]) => v);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {filterConfigs.map((fc) => (
          <Select
            key={fc.key}
            value={filters[fc.key] || ''}
            onValueChange={(v) => onFilter(fc.key, v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs w-auto min-w-[100px]">
              <SelectValue placeholder={fc.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All {fc.label}s</SelectItem>
              {fc.options.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeFilters.map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {value}
              <button className="ml-1" onClick={() => onFilter(key, '')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
            Object.keys(filters).forEach(k => onFilter(k, ''));
          }}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
