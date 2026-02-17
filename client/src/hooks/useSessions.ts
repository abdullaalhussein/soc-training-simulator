'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSessions(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['sessions', params],
    queryFn: async () => {
      const { data } = await api.get('/sessions', { params });
      return data;
    },
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data } = await api.get(`/sessions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/sessions', body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useUpdateSessionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.put(`/sessions/${id}/status`, { status });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useAddSessionMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, userIds }: { sessionId: string; userIds: string[] }) => {
      const { data } = await api.post(`/sessions/${sessionId}/members`, { userIds });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}
