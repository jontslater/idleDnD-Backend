# Skills & active abilities (backend canonical)

The backend owns skill tree data and active ability definitions. Front end should import `data/skillDefinitions.json` or call `GET /api/skills/definitions`.

Skill IDs: `{classKey}_skill_1` … `{classKey}_skill_10` (1-based, matches portal).

## Skill points

| Rule | Value |
|------|--------|
| First point at level | 6 |
| Interval | Every 2 levels (6, 8, …, 100) |
| Maximum points | 48 |
| Max rank per skill | 5 |

Earned on server level-up (`processLevelUps` + `skillPointPatchForLevelUp`). Repair: `POST /api/skills/retroactive-points/:userId`.

**Invariant:** `skillPoints + sum(skill ranks) === skillPointsEarned === calculateSkillPoints(level)` (after repair or respec).

## Global balance caps

| Stat | Cap |
|------|-----|
| Cooldown reduction (from skills) | 40% |
| Crit chance (from skills) | 75% |
| Damage reduction (from `defense_mult` skills) | 75% |

Crit damage from skills is a **percent bonus over the base ×2 crit** (e.g. +50% crit damage skill → crit multiplier ×2.5).

## Passive skill effect types

| `effect` | Meaning | Formula (per rank `r`, `baseValuePerRank` = B) |
|----------|---------|--------------------------------------------------|
| `stat_boost` | % bonus to attack or defense | `r * B` added to attack/defense % (client applies to stat) |
| `hp_percent_max` | % max HP (tanks) | `r * B` % of max HP |
| `damage_mult` | Outgoing damage | `+r * B` % damage |
| `healing_mult` | Healing done | `+r * B` % healing |
| `defense_mult` | Damage reduction | `+r * B` % DR (sum capped at 75%) |
| `crit_chance` | Crit chance | `+r * B` % (sum capped at 75%) |
| `crit_damage` | Crit damage bonus | `+r * B` % over ×2 base |
| `cooldown_red` | Cooldown reduction | `+r * B` % (sum capped at 40%; applies to **active** `cooldownMs`) |
| `lifesteal` | Lifesteal | `+r * B` % |
| `speed_boost` | Attack/cast speed | `+r * B` % |
| `double_heal_proc` | Divine Grace | `r * B` % chance to double a heal; **only if hero has ranks in that skill** (no global free proc) |

Server helper: `calculateSkillBonuses(hero)` in `skillService.js` applies caps when aggregating.

## Active abilities

Every hero has **one** active ability:

1. Use `activeAbilities.resolvedByClass[classKey]` from definitions, or
2. `ROLE_ACTIVE_ABILITIES[role]` unless `CLASS_ACTIVE_OVERRIDES[classKey]` is set.

### Role defaults (use these ids and values)

#### Tank — `shieldWall`

| Field | Value |
|-------|--------|
| `id` | `shieldWall` |
| `name` | Shield Wall |
| `role` | `tank` |
| `cooldownMs` | 45000 |
| Effect | 50% damage reduction on self for 6s; applies taunt |

```json
{
  "type": "self_damage_reduction_taunt",
  "damageReductionPercent": 50,
  "durationMs": 6000,
  "taunt": true
}
```

#### Healer — `groupHeal`

| Field | Value |
|-------|--------|
| `id` | `groupHeal` |
| `name` | Group Heal |
| `role` | `healer` |
| `cooldownMs` | 30000 |
| Effect | Heal all allies for 25% of caster max HP × `(1 + healingMultiplier/100)` |

```json
{
  "type": "aoe_heal_percent_caster_max_hp",
  "healPercentOfCasterMaxHp": 25,
  "scalesWithHealingMultiplier": true
}
```

#### DPS — `burstStrike`

| Field | Value |
|-------|--------|
| `id` | `burstStrike` |
| `name` | Burst Strike |
| `role` | `dps` |
| `cooldownMs` | 20000 |
| Effect | Single hit for 300% of attack; can crit |

```json
{
  "type": "single_target_attack_multiplier",
  "attackDamagePercent": 300,
  "canCrit": true
}
```

### Class overrides (optional)

`CLASS_ACTIVE_OVERRIDES` is sparse. All other classes use the role default. Current overrides (legacy overlay):

| Class | `id` | `cooldownMs` | Notes |
|-------|------|--------------|--------|
| `shaman` | `chainLightning` | 15000 | Chain damage (client) |
| `berserker` | `whirlwind` | 20000 | AoE damage (client) |

Necromancer `raiseDead` is not a backend class and is not defined.

### Cooldown reduction on actives

Total CDR from skills (capped at 40%):

```
effectiveCooldownMs = floor(baseCooldownMs * (1 - min(totalCdrPercent, 40) / 100))
```

Use `applyActiveCooldownMs(baseCooldownMs, totalCdrPercent)` from `skillDefinitions.js`.

UI charge bar: `1 - clamp((cooldowns[abilityId] - now) / effectiveCooldownMs, 0, 1)`.

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/skills/definitions` | Public |
| GET | `/api/skills/:userId` | Owner |
| POST | `/api/skills/:userId/allocate` | Owner |
| POST | `/api/skills/:userId/respec` | Owner (respec; gold/cooldown hook, default free) |
| POST | `/api/skills/:userId/reset` | Admin |
| POST | `/api/skills/retroactive-points/:userId` | Owner |

## Hero PUT allow-list

`PUT /api/heroes/:userId` only accepts cosmetic/settings fields (`heroUpdateAllowList.js`). Skills, levels, currency, gear, and stats cannot be set via PUT.

## Exported JSON

Path: `data/skillDefinitions.json` (regenerated on server start in non-test, or via `npm run export-skills`).
