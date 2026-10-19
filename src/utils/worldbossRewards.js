/** Default world boss reward pool when boss doc omits structured rewards. */
export function resolveWorldBossRewards(boss) {
  const rewards = boss?.rewards && typeof boss.rewards === 'object' ? boss.rewards : {};
  const gold = Number(rewards.gold);
  const tokens = Number(rewards.tokens);
  const xpBonus = Number(rewards.xpBonus);
  return {
    gold: Number.isFinite(gold) && gold >= 0 ? gold : 500,
    tokens: Number.isFinite(tokens) && tokens >= 0 ? tokens : 25,
    xpBonus: Number.isFinite(xpBonus) && xpBonus >= 0 ? xpBonus : 200
  };
}
