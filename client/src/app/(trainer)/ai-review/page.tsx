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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, AlertTriangle, Shield, Eye } from 'lucide-react';

interface Conversation {
  attemptId: string;
  user: { id: string; name: string; email: string };
  status: string;
  messageCount: number;
  startedAt: string;
  flags: { jailbreakBlocked: number; outputFiltered: number };
}

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  attempt: { id: string; status: string; user: { name: string; email: string }; startedAt: string; completedAt: string | null };
  messages: AiMessage[];
  flags: { action: string; details: any; createdAt: string }[];
}

export default function AiReviewPage() {
  const { data: sessions } = useSessions();
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['ai-conversations', selectedSession],
    queryFn: async () => {
      const { data } = await api.get(`/reports/ai-conversations?sessionId=${selectedSession}`);
      return data as { conversations: Conversation[]; pagination: any };
    },
    enabled: !!selectedSession,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['ai-conversation-detail', selectedAttempt],
    queryFn: async () => {
      const { data } = await api.get(`/reports/ai-conversations/${selectedAttempt}`);
      return data as ConversationDetail;
    },
    enabled: !!selectedAttempt,
  });

  const totalMessages = conversations?.conversations.reduce((sum, c) => sum + c.messageCount, 0) || 0;
  const totalFlags = conversations?.conversations.reduce((sum, c) => sum + c.flags.jailbreakBlocked + c.flags.outputFiltered, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> AI Conversation Review
          </h1>
          <p className="text-muted-foreground mt-1">Review SOC Mentor interactions and detect anomalies</p>
        </div>

        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a session" />
          </SelectTrigger>
          <SelectContent>
            {sessions?.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSession && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total AI Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  {totalMessages}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Anomaly Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${totalFlags > 0 ? 'text-red-500' : 'text-green-500'}`} />
                  {totalFlags}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {conversations?.conversations.filter(c => c.messageCount > 0).length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Conversations by Trainee</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations?.conversations.map((c) => (
                      <TableRow key={c.attemptId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{c.user.name}</div>
                            <div className="text-xs text-muted-foreground">{c.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === 'COMPLETED' ? 'default' : c.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.messageCount}</TableCell>
                        <TableCell>
                          {(c.flags.jailbreakBlocked + c.flags.outputFiltered) > 0 ? (
                            <div className="flex gap-1">
                              {c.flags.jailbreakBlocked > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {c.flags.jailbreakBlocked} blocked
                                </Badge>
                              )}
                              {c.flags.outputFiltered > 0 && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                  {c.flags.outputFiltered} filtered
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.startedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {c.messageCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedAttempt(c.attemptId)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {conversations?.conversations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No attempts found for this session
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selectedAttempt} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              AI Conversation — {detail?.attempt.user.name}
              {detail?.flags && detail.flags.length > 0 && (
                <Badge variant="destructive" className="ml-2">{detail.flags.length} anomalies</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-3 mt-4">
              {detail?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 ml-8'
                      : 'bg-muted mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {msg.role === 'user' ? 'Trainee' : 'SOC Mentor'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}

              {detail?.messages.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No messages in this conversation</p>
              )}

              {detail?.flags && detail.flags.length > 0 && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Anomaly Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {detail.flags.map((flag, i) => (
                        <div key={i} className="text-xs">
                          <Badge variant={flag.action === 'AI_JAILBREAK_BLOCKED' ? 'destructive' : 'secondary'} className="text-xs">
                            {flag.action === 'AI_JAILBREAK_BLOCKED' ? 'Jailbreak Blocked' : 'Output Filtered'}
                          </Badge>
                          <span className="ml-2 text-muted-foreground">{new Date(flag.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
