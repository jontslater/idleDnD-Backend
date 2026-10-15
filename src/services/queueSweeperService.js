/**
 * Launches full battlefield queues when launchAt is due (survives process restarts).
 */

import { sweepDueQueues } from './queueService.js';

const DEFAULT_INTERVAL_MS = 5000;

let intervalHandle = null;

export function startQueueSweeper(intervalMs = DEFAULT_INTERVAL_MS) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (intervalHandle) {
    return;
  }

  const tick = async () => {
    try {
      await sweepDueQueues();
    } catch (err) {
      console.error('[QueueSweeper] tick error:', err);
    }
  };

  tick();
  intervalHandle = setInterval(tick, intervalMs);
  console.log(`[QueueSweeper] Started (every ${intervalMs}ms)`);
}

export function stopQueueSweeper() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** @visibleForTesting */
export async function runQueueSweeperOnce() {
  return sweepDueQueues();
}
