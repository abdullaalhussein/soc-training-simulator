'use client';

import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ScenarioPlayer } from '@/components/scenario-player/ScenarioPlayer';

export default function ScenarioPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  useRequireAuth(['TRAINEE']);

  return <ScenarioPlayer attemptId={attemptId} />;
}
