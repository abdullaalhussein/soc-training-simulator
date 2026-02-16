'use client';

import { useState } from 'react';
import { useScenarios } from '@/hooks/useScenarios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScenarioWizard } from '@/components/admin/scenario-wizard/ScenarioWizard';
import { Plus, BookOpen, Layers, CheckSquare } from 'lucide-react';

const difficultyColors: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-800',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800',
  ADVANCED: 'bg-red-100 text-red-800',
};

export default function ScenariosPage() {
  const { data: scenarios, isLoading } = useScenarios();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scenario Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage training scenarios</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Scenario
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : scenarios?.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No scenarios yet. Create your first scenario to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios?.map((scenario: any) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={difficultyColors[scenario.difficulty]}>
                    {scenario.difficulty}
                  </Badge>
                  <Badge variant={scenario.isActive ? 'outline' : 'destructive'}>
                    {scenario.isActive ? 'Active' : 'Inactive'}
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
                    <BookOpen className="h-4 w-4" />
                    <span>{scenario.estimatedMinutes} min estimated</span>
                  </div>
                  {scenario.mitreAttackIds?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scenario.mitreAttackIds.map((id: string) => (
                        <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Scenario</DialogTitle>
          </DialogHeader>
          <ScenarioWizard onComplete={() => setWizardOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
