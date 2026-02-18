import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getTrainerSocket, getTraineeSocket } from '@/lib/socket';

export interface SessionMessage {
  id: string;
  sessionId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    role: 'ADMIN' | 'TRAINER' | 'TRAINEE';
  };
}

export function useSessionMessages(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const queryKey = ['session-messages', sessionId];

  const { data: messages = [], isLoading } = useQuery<SessionMessage[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/sessions/${sessionId}/messages`);
      return data;
    },
    enabled: !!sessionId,
  });

  // Listen for real-time messages via socket
  useEffect(() => {
    if (!sessionId || !user) return;

    const socket = user.role === 'TRAINEE' ? getTraineeSocket() : getTrainerSocket();

    // Ensure socket is connected and joined to the session room
    if (!socket.connected) {
      socket.auth = { token: localStorage.getItem('token') };
      socket.connect();
    }
    socket.emit('join-session', sessionId);

    const handleMessage = (message: SessionMessage) => {
      if (message.sessionId !== sessionId) return;
      queryClient.setQueryData<SessionMessage[]>(queryKey, (old = []) => {
        // Deduplicate by id
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message];
      });
    };

    socket.on('session-message', handleMessage);
    return () => {
      socket.off('session-message', handleMessage);
    };
  }, [sessionId, user, queryClient, queryKey]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!sessionId || !user || !content.trim()) return;
      const socket = user.role === 'TRAINEE' ? getTraineeSocket() : getTrainerSocket();
      socket.emit('send-session-message', { sessionId, content: content.trim() });
    },
    [sessionId, user],
  );

  return { messages, isLoading, sendMessage };
}
