'use client';

import { useSessions } from '@/hooks/useSessions';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useState } from 'react';
import { BookOpen, Trophy, Target, Clock } from 'lucide-react';

const difficultyColors: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ADVANCED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusColors: Record<string, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  TIMED_OUT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Ready to Investigate',
  IN_PROGRESS: 'Investigating',
  COMPLETED: 'Completed',
  TIMED_OUT: 'Timed Out',
};

export default function TraineeDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading } = useSessions();
  const [starting, setStarting] = useState<string | null>(null);

  const handleStart = async (sessionId: string) => {
    setStarting(sessionId);
    try {
      const { data: attempt } = await api.post('/attempts/start', { sessionId });
      router.push(`/scenario/${attempt.id}`);
    } catch (err) {
      console.error('Failed to start attempt:', err);
    } finally {
      setStarting(null);
    }
  };

  const completedSessions = sessions?.filter((s: any) =>
    s.attempts?.some((a: any) => a.status === 'COMPLETED')
  ) || [];

  const avgScore = completedSessions.length > 0
    ? completedSessions.reduce((sum: number, s: any) => {
        const attempt = s.attempts?.find((a: any) => a.status === 'COMPLETED');
        return sum + (attempt?.totalScore || 0);
      }, 0) / completedSessions.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1">Continue your SOC analyst training</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Assigned Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Trophy className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedSessions.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(avgScore)}</p>
                <p className="text-sm text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Your Sessions</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : sessions?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No sessions assigned yet. Your trainer will assign scenarios to you.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions?.map((session: any) => {
              const attempt = session.attempts?.[0];
              const status = attempt?.status || 'NOT_STARTED';

              return (
                <Card key={session.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge className={difficultyColors[session.scenario?.difficulty] || ''}>
                        {session.scenario?.difficulty}
                      </Badge>
                      <Badge className={statusColors[status] || ''}>
                        {statusLabels[status] || status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2">{session.scenario?.name}</CardTitle>
                    <CardDescription>{session.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{session.scenario?.estimatedMinutes} min estimated</span>
                    </div>
                    {attempt?.totalScore > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Score: {attempt.totalScore}/100</p>
                      </div>
                    )}
                  </CardContent>
                  <div className="p-6 pt-0">
                    {status === 'COMPLETED' ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/scenario/${attempt.id}`)}
                      >
                        View Results
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleStart(session.id)}
                        disabled={session.status !== 'ACTIVE' || starting === session.id}
                      >
                        {starting === session.id ? 'Starting...' : status === 'IN_PROGRESS' ? 'Continue Investigation' : 'Start Investigation'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
