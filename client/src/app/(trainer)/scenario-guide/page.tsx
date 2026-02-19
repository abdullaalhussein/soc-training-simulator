'use client';

import { useRouter } from 'next/navigation';
import { useScenarios } from '@/hooks/useScenarios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MitreAttackBadge } from '@/components/MitreAttackBadge';
import { Layers, CheckSquare, BookOpen, Clock } from 'lucide-react';

const difficultyColors: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ADVANCED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function TrainerScenariosPage() {
  const router = useRouter();
  const { data: scenarios, isLoading } = useScenarios();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scenarios</h1>
        <p className="text-muted-foreground mt-1">
          Browse scenarios to understand stages, questions, correct answers, and how to guide trainees.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : scenarios?.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No scenarios available.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios?.filter((s: any) => s.isActive).map((scenario: any) => (
            <Card
              key={scenario.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push(`/scenario-guide/${scenario.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={difficultyColors[scenario.difficulty]}>
                    {scenario.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{scenario.name}</CardTitle>
                <CardDescription>{scenario.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>{scenario.stages?.length || 0} stages</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckSquare className="h-4 w-4" />
                    <span>{scenario._count?.checkpoints || 0} checkpoints</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{scenario.estimatedMinutes} min estimated</span>
                  </div>
                  {scenario.mitreAttackIds?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scenario.mitreAttackIds.map((id: string) => (
                        <MitreAttackBadge key={id} id={id} className="text-xs" />
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
