'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ScenarioPlayer } from '@/components/scenario-player/ScenarioPlayer';
import { LessonView } from '@/components/scenario-player/LessonView';
import { Skeleton } from '@/components/ui/skeleton';

export default function ScenarioPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  useRequireAuth(['TRAINEE']);
  const [lessonComplete, setLessonComplete] = useState(false);

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: async () => {
      const { data } = await api.get(`/attempts/${attemptId}`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const lessonContent = attempt?.session?.scenario?.lessonContent;

  if (lessonContent && !lessonComplete) {
    return (
      <LessonView
        scenarioName={attempt.session.scenario.name}
        lessonContent={lessonContent}
        onContinue={() => setLessonComplete(true)}
      />
    );
  }

  return <ScenarioPlayer attemptId={attemptId} />;
}
