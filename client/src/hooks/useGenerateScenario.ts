'use client';

import { useState, useRef, useCallback } from 'react';
import { getCsrfToken } from '@/lib/api';

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
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/ai/generate-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || `Server error (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events (separated by double newline)
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let blockEvent = '';
          let blockData = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) {
              blockEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              blockData = line.slice(6);
            }
          }

          if (blockEvent === 'text' && blockData) {
            try {
              const chunk = JSON.parse(blockData) as string;
              accumulated += chunk;
              setStreamingText(accumulated);
            } catch {
              // skip malformed chunk
            }
          } else if (blockEvent === 'error' && blockData) {
            const errData = JSON.parse(blockData) as { message: string };
            throw new Error(errData.message);
          }
          // 'done' event — loop will end on next reader.read()
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
