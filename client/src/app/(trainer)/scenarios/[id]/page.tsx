'use client';

import { useParams, useRouter } from 'next/navigation';
import { useScenario } from '@/hooks/useScenarios';
import { Button } from '@/components/ui/button';
import { ScenarioDetailView } from '@/components/ScenarioDetailView';
import { ArrowLeft } from 'lucide-react';

export default function TrainerScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: scenario, isLoading } = useScenario(params.id as string);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/scenarios')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scenarios
        </Button>
      </div>
      <ScenarioDetailView scenario={scenario} isLoading={isLoading} />
    </div>
  );
}
