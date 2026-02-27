'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAiStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/ai/status');
      return data as { available: boolean };
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
    retry: false,
  });

  return {
    aiAvailable: data?.available ?? false,
    isLoading,
  };
}
