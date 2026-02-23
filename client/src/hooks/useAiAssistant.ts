'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getTraineeSocket } from '@/lib/socket';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function useAiAssistant(attemptId: string) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false;
    api.get(`/attempts/${attemptId}/ai-messages`)
      .then(({ data }) => {
        if (!cancelled) {
          setMessages(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [attemptId]);

  // Listen for AI responses via socket
  useEffect(() => {
    const socket = getTraineeSocket();

    const handleResponse = (data: { content: string; remaining: number }) => {
      const newMsg: AiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setRemaining(data.remaining);
      setIsSending(false);
    };

    socket.on('ai-assistant-response', handleResponse);
    return () => { socket.off('ai-assistant-response', handleResponse); };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || isSending) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    const socket = getTraineeSocket();
    socket.emit('ai-assistant-message', { attemptId, message: content.trim() });
  }, [attemptId, isSending]);

  return { messages, isLoading, isSending, remaining, sendMessage };
}
