'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface GenerateScenarioParams {
  description: string;
  difficulty?: string;
  mitreAttackIds?: string[];
  numStages?: number;
  category?: string;
}

export function useGenerateScenario() {
  return useMutation({
    mutationFn: async (params: GenerateScenarioParams) => {
      const { data } = await api.post('/ai/generate-scenario', params);
      return data;
    },
  });
}
