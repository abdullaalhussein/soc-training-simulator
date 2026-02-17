'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useScenarios, useDeleteScenario, useImportScenario } from '@/hooks/useScenarios';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScenarioWizard } from '@/components/admin/scenario-wizard/ScenarioWizard';
import { MitreAttackBadge } from '@/components/MitreAttackBadge';
import { toast } from '@/components/ui/toaster';
import { Plus, BookOpen, Layers, CheckSquare, MoreVertical, Pencil, Download, Trash2, Upload, Eye } from 'lucide-react';

const difficultyColors: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-800',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800',
  ADVANCED: 'bg-red-100 text-red-800',
};

export default function ScenariosPage() {
  const router = useRouter();
  const { data: scenarios, isLoading } = useScenarios();
  const deleteScenario = useDeleteScenario();
  const importScenario = useImportScenario();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (scenarioId: string) => {
    try {
      const { data } = await api.get(`/scenarios/${scenarioId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.name || 'scenario').replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Scenario exported' });
    } catch {
      toast({ title: 'Failed to export scenario', variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importScenario.mutateAsync(data);
      toast({ title: 'Scenario imported successfully' });
    } catch {
      toast({ title: 'Failed to import scenario. Check the JSON format.', variant: 'destructive' });
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteScenario.mutateAsync(deleteTarget.id);
      toast({ title: 'Scenario deactivated' });
    } catch {
      toast({ title: 'Failed to deactivate scenario', variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const openEdit = async (scenario: any) => {
    try {
      // Fetch full scenario with stages, hints, checkpoints for editing
      const { data } = await api.get(`/scenarios/${scenario.id}`);
      setEditingScenario(data);
    } catch {
      toast({ title: 'Failed to load scenario details', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Scenario Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage training scenarios</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importScenario.isPending}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Scenario
          </Button>
        </div>
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
            <Card key={scenario.id} className={!scenario.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={difficultyColors[scenario.difficulty]}>
                    {scenario.difficulty}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Badge variant={scenario.isActive ? 'outline' : 'destructive'}>
                      {scenario.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/scenarios/${scenario.id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(scenario)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(scenario.id)}>
                          <Download className="mr-2 h-4 w-4" /> Export
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(scenario)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardTitle
                  className="text-lg mt-2 cursor-pointer hover:underline"
                  onClick={() => router.push(`/scenarios/${scenario.id}`)}
                >
                  {scenario.name}
                </CardTitle>
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

      {/* Create Scenario Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Scenario</DialogTitle>
          </DialogHeader>
          <ScenarioWizard onComplete={() => setWizardOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Scenario Dialog */}
      <Dialog open={!!editingScenario} onOpenChange={(open) => { if (!open) setEditingScenario(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scenario</DialogTitle>
          </DialogHeader>
          {editingScenario && (
            <ScenarioWizard
              scenario={editingScenario}
              onComplete={() => setEditingScenario(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Scenario</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.name}</strong>? It will no longer be available for new sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteScenario.isPending}>
              {deleteScenario.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
