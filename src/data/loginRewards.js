// Daily login reward structure
export const LOGIN_REWARDS = {
  // Days 1-7 rewards
  daily: [
    { day: 1, gold: 50, tokens: 0 },
    { day: 2, gold: 75, tokens: 0 },
    { day: 3, gold: 100, tokens: 5 },
    { day: 4, gold: 125, tokens: 5 },
    { day: 5, gold: 150, tokens: 10 },
    { day: 6, gold: 200, tokens: 10 },
    { day: 7, gold: 250, tokens: 25, bonus: { type: 'materials', rarity: 'rare', amount: 10 } }
  ],
  
  // Monthly milestone rewards
  monthly: [
    { days: 7, gold: 500, tokens: 50 },
    { days: 14, gold: 1000, tokens: 100 },
    { days: 21, gold: 1500, tokens: 150 },
    { days: 28, gold: 2000, tokens: 200, bonus: { type: 'item', rarity: 'epic' } }
  ]
};

export function getDailyReward(day) {
  if (day < 1 || day > 7) return null;
  return LOGIN_REWARDS.daily[day - 1];
}

export function getMonthlyReward(days) {
  return LOGIN_REWARDS.monthly.find(r => r.days === days) || null;
}
