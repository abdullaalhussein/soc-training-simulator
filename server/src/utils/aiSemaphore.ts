import { env } from '../config/env';

// D-01: AI concurrency semaphore — limits parallel AI API calls
const MAX_CONCURRENT = env.AI_MAX_CONCURRENT;
let activeAiCalls = 0;
const aiQueue: Array<{ resolve: () => void }> = [];

export async function acquireAiSlot(): Promise<void> {
  if (activeAiCalls < MAX_CONCURRENT) {
    activeAiCalls++;
    return;
  }
  return new Promise((resolve) => {
    aiQueue.push({ resolve });
  });
}

export function releaseAiSlot(): void {
  activeAiCalls--;
  const next = aiQueue.shift();
  if (next) {
    activeAiCalls++;
    next.resolve();
  }
}
