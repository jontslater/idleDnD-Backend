/** UTC period keys for lazy per-hero quest resets */
export function buildPeriodKey(type, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();

  if (type === 'daily') {
    return `daily-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  if (type === 'weekly') {
    const week = getISOWeek(date);
    return `weekly-${y}-W${String(week).padStart(2, '0')}`;
  }

  if (type === 'monthly') {
    return `monthly-${y}-${String(m).padStart(2, '0')}`;
  }

  throw new Error(`Unknown quest period type: ${type}`);
}

function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

export const PERIOD_KEY_FIELD = {
  daily: 'dailyPeriodKey',
  weekly: 'weeklyPeriodKey',
  monthly: 'monthlyPeriodKey'
};
