'use client';

import { useSessions, useCreateSession, useUpdateSessionStatus, useDeleteSession } from '@/hooks/useSessions';
import { useScenarios } from '@/hooks/useScenarios';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Users, Monitor, Play, Pause, Square, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-400',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PAUSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function TrainerConsole() {
  const router = useRouter();
  const { data: sessions, isLoading } = useSessions();
  const { data: scenarios } = useScenarios();
  const { data: trainees } = useUsers({ role: 'TRAINEE' });
  const createSession = useCreateSession();
  const updateStatus = useUpdateSessionStatus();
  const deleteSession = useDeleteSession();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState({ name: '', scenarioId: '', timeLimit: '' });
  const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);

  const handleCreate = async (launch = false) => {
    if (!newSession.name || !newSession.scenarioId) return;
    try {
      const session = await createSession.mutateAsync({
        name: newSession.name,
        scenarioId: newSession.scenarioId,
        timeLimit: newSession.timeLimit ? parseInt(newSession.timeLimit) : undefined,
        memberIds: selectedTrainees,
      });
      if (launch) {
        await updateStatus.mutateAsync({ id: session.id, status: 'ACTIVE' });
        toast({ title: 'Session created and launched' });
      } else {
        toast({ title: 'Session created successfully' });
      }
      setDialogOpen(false);
      setNewSession({ name: '', scenarioId: '', timeLimit: '' });
      setSelectedTrainees([]);
    } catch {
      toast({ title: 'Failed to create session', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (sessionId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id: sessionId, status });
      toast({ title: `Session ${status.toLowerCase()}` });
    } catch {
      toast({ title: 'Failed to update session', variant: 'destructive' });
    }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession.mutateAsync(sessionId);
      toast({ title: 'Session deleted' });
    } catch {
      toast({ title: 'Failed to delete session', variant: 'destructive' });
    }
  };

  const activeSessions = sessions?.filter((s: any) => s.status === 'ACTIVE') || [];
  const nonCompletedSessions = sessions?.filter((s: any) => s.status !== 'COMPLETED') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trainer Console</h1>
          <p className="text-muted-foreground mt-1">Manage training sessions and monitor progress</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Training Session</DialogTitle>
              <DialogDescription>Set up a new training session for your trainees.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Session Name</Label>
                <Input
                  placeholder="e.g., Cohort 5 - Week 3"
                  value={newSession.name}
                  onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Scenario</Label>
                <Select
                  value={newSession.scenarioId}
                  onValueChange={(v) => setNewSession({ ...newSession, scenarioId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select scenario" /></SelectTrigger>
                  <SelectContent>
                    {scenarios?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.difficulty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Limit (minutes, optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 60"
                  value={newSession.timeLimit}
                  onChange={(e) => setNewSession({ ...newSession, timeLimit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign Trainees</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                  {trainees?.map((t: any) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-accent rounded">
                      <input
                        type="checkbox"
                        checked={selectedTrainees.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTrainees([...selectedTrainees, t.id]);
                          else setSelectedTrainees(selectedTrainees.filter((id) => id !== t.id));
                        }}
                      />
                      {t.name} ({t.email})
                    </label>
                  ))}
                  {(!trainees || trainees.length === 0) && (
                    <p className="text-sm text-muted-foreground">No trainees found</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="secondary" onClick={() => handleCreate(false)} disabled={createSession.isPending || updateStatus.isPending}>
                {createSession.isPending ? 'Creating...' : 'Create as Draft'}
              </Button>
              <Button onClick={() => handleCreate(true)} disabled={createSession.isPending || updateStatus.isPending}>
                <Play className="mr-1 h-4 w-4" />
                {createSession.isPending || updateStatus.isPending ? 'Launching...' : 'Create & Launch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeSessions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Active Sessions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session: any) => (
              <Card key={session.id} className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{session.name}</CardTitle>
                    <Badge className={statusColors[session.status]}>{session.status}</Badge>
                  </div>
                  <CardDescription>{session.scenario?.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{session._count?.members || 0} trainees</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Monitor className="h-4 w-4" />
                      <span>{session._count?.attempts || 0} active</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/sessions/${session.id}`)}
                    >
                      <Monitor className="mr-1 h-3 w-3" /> Monitor
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(session.id, 'PAUSED')}
                    >
                      <Pause className="mr-1 h-3 w-3" /> Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(session.id, 'COMPLETED')}
                    >
                      <Square className="mr-1 h-3 w-3" /> End
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-3">All Sessions</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : nonCompletedSessions.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No sessions created yet. Click "Create Session" to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonCompletedSessions.map((session: any) => (
              <Card key={session.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{session.name}</CardTitle>
                    <Badge className={statusColors[session.status]}>{session.status}</Badge>
                  </div>
                  <CardDescription className="text-xs">{session.scenario?.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <span>{session._count?.members || 0} trainees</span>
                    <span>{session._count?.attempts || 0} attempts</span>
                  </div>
                  <div className="flex gap-2">
                    {session.status === 'DRAFT' && (
                      <>
                        <Button size="sm" onClick={() => handleStatusChange(session.id, 'ACTIVE')}>
                          <Play className="mr-1 h-3 w-3" /> Launch
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(session.id)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      </>
                    )}
                    {session.status === 'PAUSED' && (
                      <Button size="sm" onClick={() => handleStatusChange(session.id, 'ACTIVE')}>
                        <Play className="mr-1 h-3 w-3" /> Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => router.push(`/sessions/${session.id}`)}>
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
