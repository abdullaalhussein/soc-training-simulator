import { env } from '../config/env';

// D-01: AI concurrency semaphore — limits parallel AI API calls
const MAX_CONCURRENT = env.AI_MAX_CONCURRENT;
// ML-02: Cap queue size and add timeout to prevent unbounded memory growth
const MAX_QUEUE_SIZE = 50;
const ACQUIRE_TIMEOUT_MS = 30_000; // 30 seconds

let activeAiCalls = 0;

interface QueueEntry {
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}

const aiQueue: QueueEntry[] = [];

export async function acquireAiSlot(): Promise<void> {
  if (activeAiCalls < MAX_CONCURRENT) {
    activeAiCalls++;
    return;
  }

  // ML-02: Reject immediately if queue is full
  if (aiQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error('AI service is at capacity. Please try again later.');
  }

  return new Promise<void>((resolve, reject) => {
    const entry: QueueEntry = {
      resolve,
      timer: setTimeout(() => {
        const idx = aiQueue.indexOf(entry);
        if (idx !== -1) aiQueue.splice(idx, 1);
        reject(new Error('AI request timed out waiting in queue.'));
      }, ACQUIRE_TIMEOUT_MS),
    };
    aiQueue.push(entry);
  });
}

export function releaseAiSlot(): void {
  activeAiCalls--;
  const next = aiQueue.shift();
  if (next) {
    clearTimeout(next.timer);
    activeAiCalls++;
    next.resolve();
  }
}
