'use client';

import { useState, useRef, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface GenerateScenarioParams {
  description: string;
  difficulty?: string;
  mitreAttackIds?: string[];
  numStages?: number;
  category?: string;
}

export function useGenerateScenarioStream() {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const startStreaming = useCallback(async (params: GenerateScenarioParams): Promise<string> => {
    setStreamingText('');
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/ai/generate-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Server error (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (eventType === 'text') {
              const chunk = JSON.parse(data) as string;
              accumulated += chunk;
              setStreamingText(accumulated);
            } else if (eventType === 'error') {
              const errData = JSON.parse(data) as { message: string };
              throw new Error(errData.message);
            }
            // 'done' event — loop will end on next reader.read()
            eventType = '';
          }
        }
      }

      return accumulated;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled — not an error
        return accumulated;
      }
      setError(err.message || 'Streaming failed');
      throw err;
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  return { streamingText, isStreaming, error, startStreaming, abort };
}
