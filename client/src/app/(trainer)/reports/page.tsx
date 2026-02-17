'use client';

import { useState } from 'react';
import { useSessions } from '@/hooks/useSessions';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Trophy, BarChart3, Target } from 'lucide-react';

export default function ReportsPage() {
  const { data: sessions } = useSessions();
  const [selectedSession, setSelectedSession] = useState('');

  const { data: summary } = useQuery({
    queryKey: ['session-summary', selectedSession],
    queryFn: async () => {
      const { data } = await api.get(`/reports/session/${selectedSession}/summary`);
      return data;
    },
    enabled: !!selectedSession,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', selectedSession],
    queryFn: async () => {
      const { data } = await api.get(`/reports/session/${selectedSession}/leaderboard`);
      return data;
    },
    enabled: !!selectedSession,
  });

  const handleExportCSV = () => {
    if (!selectedSession) return;
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/session/${selectedSession}/csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">View session results and trainee performance</p>
        </div>
        {selectedSession && (
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      <div className="max-w-sm">
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger><SelectValue placeholder="Select a session" /></SelectTrigger>
          <SelectContent>
            {sessions?.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name} - {s.scenario?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSession && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Target className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{summary.stats.averageScore}</p>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.stats.highestScore}</p>
                    <p className="text-sm text-muted-foreground">Highest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.stats.completedAttempts}/{summary.stats.totalMembers}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Target className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.stats.lowestScore}</p>
                    <p className="text-sm text-muted-foreground">Lowest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Trainee</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Accuracy</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Investigation</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Evidence</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Response</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Report</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Penalty</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry: any) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-bold">
                          {entry.rank <= 3 ? ['', '1st', '2nd', '3rd'][entry.rank] : `#${entry.rank}`}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.userName}</p>
                            <p className="text-xs text-muted-foreground">{entry.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline">{entry.status}</Badge></TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{entry.accuracyScore}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{entry.investigationScore}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{entry.evidenceScore}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{entry.responseScore}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{entry.reportScore}</TableCell>
                        <TableCell className="text-right text-destructive hidden lg:table-cell">-{entry.hintPenalty}</TableCell>
                        <TableCell className="text-right font-bold text-lg">{entry.totalScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Skeleton className="h-40" />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
