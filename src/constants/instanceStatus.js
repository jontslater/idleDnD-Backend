/**
 * Canonical instance status values (overlay + API).
 * Readers should treat legacy `active` / `starting` / `in_progress` as in-progress where noted.
 */

export const INSTANCE_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const QUEUE_STATUS = {
  OPEN: 'open',
  READY: 'ready',
  LAUNCHING: 'launching'
};

/** @param {string | undefined} status */
export function isInstanceInProgress(status) {
  return (
    status === INSTANCE_STATUS.IN_PROGRESS ||
    status === 'active' ||
    status === 'starting' ||
    status === 'in_progress'
  );
}
