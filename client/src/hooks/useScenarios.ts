'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useScenarios(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['scenarios', params],
    queryFn: async () => {
      const { data } = await api.get('/scenarios', { params });
      return data;
    },
  });
}

export function useScenario(id: string) {
  return useQuery({
    queryKey: ['scenario', id],
    queryFn: async () => {
      const { data } = await api.get(`/scenarios/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/scenarios', body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/scenarios/${id}`, body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}
