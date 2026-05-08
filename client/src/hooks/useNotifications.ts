import type { Subscription } from '@/types';

// Web push disabled — notifications handled by native Android app via FCM.
// Kept as exports so Settings.tsx and App.tsx don't break.

export async function subscribeToPush(): Promise<void> {
  // no-op
}

export function useNotifications(_subscriptions: Subscription[]) {
  // no-op
}
