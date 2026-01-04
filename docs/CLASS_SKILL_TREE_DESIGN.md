# Class-Specific Skill Tree Design Document

## Overview

This document outlines the design plan for creating unique skill trees for each class. Currently, all classes within a role category (tank/healer/dps) share the same skill tree. We need to customize each class to reflect their unique playstyles, abilities, and themes.

## Design Philosophy

### Core Principles
1. **Class Identity**: Each skill tree should reinforce the class's unique identity and playstyle
2. **Ability Synergy**: Skills should enhance or modify the class's primary ability
3. **Meaningful Choices**: Players should have meaningful decisions about which skills to invest in
4. **Balance**: All classes should feel viable, but with different strengths
5. **Theme Consistency**: Skill names and effects should match the class's theme (holy, nature, shadow, etc.)

### Skill Tree Structure
- **17 skills per class** (unlocked at levels 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37)
- **5 points max per skill** (total of 85 potential points, but limited by level)
- **Skill points earned at levels**: 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100 (every 2 levels, up to level 100)

### Skill Effect Types
- `stat_boost` - Increases attack/defense/hp (flat values)
- `damage_mult` - Increases damage dealt (%)
- `healing_mult` - Increases healing done (%)
- `defense_mult` - Reduces damage taken (%)
- `crit_chance` - Increases critical hit chance (%)
- `crit_damage` - Increases critical hit damage (%)
- `cooldown_red` - Reduces ability cooldowns (%)
- `lifesteal` - Heals for % of damage dealt
- `speed_boost` - Increases attack/cast speed (%)
- `ability_enhance` - Modifies class abilities (duration, effectiveness, etc.)
- `passive_effect` - Unique passive effects (reflect damage, execute damage, etc.)

---

## TANK CLASSES (6 Classes)

### 1. Guardian (Shield Guardian) 🛡️
**Theme**: Traditional protector with party-wide defense
**Primary Ability**: Shield Wall - Creates protective barrier reducing party damage by 30% for 8 seconds
**Playstyle**: Best for encounters with heavy AoE damage or when party is undergeared

**Skill Tree Focus**: Party protection, Shield Wall enhancement, defensive stats

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Shield Wall Mastery** - Increases Shield Wall duration by +0.5 seconds per point and reduces Shield Wall cooldown by 2% per point. (ability_enhance: +0.5s duration, -2% cooldown per point)
2. **Skill 2** (Lv 7): **Bastion of Defense** - Increases Shield Wall damage reduction by +1% per point (from base 30%). (ability_enhance: +1% damage reduction per point)
3. **Skill 3** (Lv 9): **Protective Aura** - Provides a passive party-wide damage reduction of +0.5% per point. (passive_effect: +0.5% party damage reduction per point)
4. **Skill 4** (Lv 11): **Shield Absorption** - During Shield Wall, converts 3% of damage prevented per point into shields that are granted to the lowest HP party members (including other tanks). (ability_enhance: converts blocked damage to shield, 3% per point, max 15% at 5 points)
5. **Skill 5** (Lv 13): **Fortitude** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
6. **Skill 6** (Lv 15): **Defender's Challenge** - Generates threat equal to 20% of damage prevented on party members per point. When party members are below 50% HP, threat generation doubles. (passive_effect: threat generation from damage prevented, 20% per point, max 100% at 5 points)
7. **Skill 7** (Lv 17): **Iron Bulwark** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
8. **Skill 8** (Lv 19): **Retaliatory Guard** - Damage blocked during Shield Wall has a 10% chance per point to reflect 50% of the blocked damage back at the attacker. (ability_enhance: reflect blocked damage, 10% chance per point, 50% damage reflected, max 50% chance at 5 points)
9. **Skill 9** (Lv 21): **Last Stand Legacy** - When the Guardian is downed, grants a shield equal to 10% of the Guardian's max HP per point to the hero with the next highest threat. (passive_effect: death trigger shield, 10% max HP per point, max 50% at 5 points)
10. **Skill 10** (Lv 23): **Resolute Protector** - While Shield Wall is active, the Guardian takes an additional 2% damage reduction per point, and 50% of that extra damage reduction is converted to healing distributed to the lowest HP party members. (ability_enhance: +2% damage reduction, converts reduction to healing, 50% conversion rate, max 10% reduction at 5 points)
11. **Skill 11** (Lv 25): **Iron Skin** - Passive HP regeneration equal to 1% of defense per point per second. (passive_effect: HP regen based on defense, 1% per point, max 5% at 5 points)
12. **Skill 12** (Lv 27): **Intercept** - Automatically intercepts attacks on party members with a 15-second internal cooldown (reduced by 2 seconds per point), taking 100% of the damage. (passive_effect: intercept attacks, 15s base cooldown, -2s per point, max 5s cooldown at 5 points)
13. **Skill 13** (Lv 29): **Armor Mastery** - Increases defense effectiveness by 5% per point. Each point of defense provides additional damage reduction. (defense_mult: +5% defense effectiveness per point, max 25% at 5 points)
14. **Skill 14** (Lv 31): **Intercept Mastery** - When Intercept triggers, the Guardian takes 10% less damage per point from the intercepted attack, and generates threat equal to 50% of the intercepted damage per point. (passive_effect: intercept enhancement, -10% damage per point, +50% threat per point, max -50% damage +250% threat at 5 points)
15. **Skill 15** (Lv 33): **Lingering Protection** - When Shield Wall ends, grants a lingering damage reduction buff to all party members equal to 1% per point for 5 seconds. (ability_enhance: Shield Wall end effect, 1% party DR per point, max 5% at 5 points)
16. **Skill 16** (Lv 35): **Unbreakable Fortress** - While Shield Wall is active, the Guardian's defense and HP bonuses from skills are increased by 10% per point. (ability_enhance: Shield Wall active bonus, 10% stat bonus per point, max 50% at 5 points)

**Ideas**:
- Shield Wall duration increase
- Shield Wall damage reduction increase
- Shield Wall cooldown reduction
- Party-wide defensive bonuses
- Emergency HP/threat generation

---

### 2. Paladin (Holy Defender) ✨
**Theme**: Divine tank with self-cleansing
**Primary Ability**: Divine Shield - Becomes immune to all damage and cleanses all debuffs for 5 seconds
**Playstyle**: Best against bosses with heavy debuffs or burst damage

**Skill Tree Focus**: Divine Shield enhancement, debuff resistance, self-sustain

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Divine Shield Mastery** - Increases Divine Shield duration by +0.3 seconds per point and reduces Divine Shield cooldown by 2% per point. (ability_enhance: +0.3s duration, -2% cooldown per point)
2. **Skill 2** (Lv 7): **Divine Aegis** - When Divine Shield is activated, restores HP equal to 2% of max HP per point over the duration. (ability_enhance: healing during Divine Shield, 2% max HP per point, max 10% at 5 points)
3. **Skill 3** (Lv 9): **Divine Resilience** - Provides passive debuff resistance of 5% per point. Reduces duration and effectiveness of debuffs. (passive_effect: debuff resistance, 5% per point, max 25% at 5 points)
4. **Skill 4** (Lv 11): **Divine Restoration** - When Divine Shield ends, restores HP equal to 3% of max HP per point and grants a brief damage reduction buff of 5% per point for 3 seconds. (ability_enhance: post-Divine Shield effect, 3% max HP healing per point, 5% DR per point for 3s, max 15% HP + 25% DR at 5 points)
5. **Skill 5** (Lv 13): **Divine Retribution** - Has a 5% chance per point to reflect debuffs back onto the caster instead of being affected. (passive_effect: debuff reflect, 5% chance per point, max 25% chance at 5 points)
6. **Skill 6** (Lv 15): **Divine Grace** - Increases all healing received by 4% per point. Makes all healing effects more effective on the Paladin. (passive_effect: healing received bonus, 4% per point, max 20% at 5 points)
7. **Skill 7** (Lv 17): **Holy Retaliation** - While Divine Shield is active, attacks against the Paladin have a 15% chance per point to deal holy damage back to the attacker equal to 20% of the attempted damage. (ability_enhance: holy damage reflect during Divine Shield, 15% chance per point, 20% damage reflected, max 75% chance at 5 points)
8. **Skill 8** (Lv 19): **Righteous Fury** - Holy damage dealt generates threat equal to 30% of the damage per point. Additionally, all attacks have a 5% chance per point to deal bonus holy damage equal to 10% of attack power. (passive_effect: holy damage threat generation, 30% per point, +5% chance for bonus holy damage per point, max 150% threat + 25% chance at 5 points)
9. **Skill 9** (Lv 21): **Divine Power** - Increases all holy damage dealt by 8% per point. (damage_mult: +8% holy damage per point, max 40% at 5 points)
10. **Skill 10** (Lv 23): **Lay on Hands** - Instant self-heal equal to 20% of defense per point. Can be used outside of battle initiative. Has a 60-second cooldown (reduced by 5 seconds per point). (passive_effect: instant self-heal based on defense, 20% defense per point, 60s base cooldown, -5s per point, max 100% defense heal + 35s cooldown at 5 points)
11. **Skill 11** (Lv 25): **Consecration** - AoE holy damage to all enemies dealing 15% of attack power per point as holy damage. Inflicts weakness reducing enemy attack damage by 3% per point for 8 seconds. Generates threat equal to 50% of damage dealt per point. 30-second cooldown (reduced by 2 seconds per point). (passive_effect: AoE holy damage + weakness debuff + threat, 15% attack power per point, 3% attack reduction per point, 50% threat per point, 30s base cooldown, -2s per point, max 75% attack + 15% reduction + 250% threat + 20s cooldown at 5 points)
12. **Skill 12** (Lv 27): **Divine Bulwark** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
13. **Skill 13** (Lv 29): **Divine Vitality** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
14. **Skill 14** (Lv 31): **Consecration Mastery** - Enhances Consecration to heal the Paladin for 5% of damage dealt per point. Additionally increases Consecration damage by 10% per point and weakness debuff duration by 1 second per point. (passive_effect: Consecration enhancement, 5% damage to healing per point, +10% damage per point, +1s debuff duration per point, max 25% healing + 50% damage + 5s duration at 5 points)
15. **Skill 15** (Lv 33): **Divine Wrath** - While Divine Shield is active, the Paladin deals 10% more holy damage per point and generates threat equal to 20% of all damage dealt per point. (ability_enhance: Divine Shield while-active bonus, +10% holy damage per point, +20% threat generation per point, max +50% holy damage + 100% threat at 5 points)
16. **Skill 16** (Lv 35): **Divine Radiance** - All attacks deal additional holy damage equal to 8% of attack power per point. This holy damage benefits from all holy damage bonuses and threat generation. (passive_effect: passive holy damage on all attacks, 8% attack power per point, max 40% at 5 points)

**Ideas**:
- Divine Shield duration increase
- Divine Shield cooldown reduction
- Debuff resistance/cleanse on demand
- Post-Divine Shield healing
- Holy damage/threat generation

---

### 3. Warden (Wild Warden) 🌿
**Theme**: Nature tank with damage reflection
**Primary Ability**: Thorns - Reflects 35% of all damage taken back to attackers (Passive)
**Playstyle**: Best in sustained fights where tank is taking constant damage

**Skill Tree Focus**: Thorns enhancement, nature-based healing, damage reflection

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Thorns Mastery** - Increases Thorns reflect damage by +1% per point (from base 35%). (ability_enhance: +1% reflect damage per point, max +5% at 5 points)
2. **Skill 2** (Lv 7): **Nature's Embrace** - Heals the Warden for 5% of damage reflected by Thorns per point. (ability_enhance: healing from Thorns damage, 5% per point, max 25% at 5 points)
3. **Skill 3** (Lv 9): **Entangling Roots** - Thorns damage has a 8% chance per point to root enemies, reducing their attack damage by 10% per point for 5 seconds. (ability_enhance: root/entangle from Thorns, 8% chance per point, 10% attack reduction per point, max 40% chance + 50% reduction at 5 points)
4. **Skill 4** (Lv 11): **Earth Shield** - Castable shield that triggers healing when the Warden is attacked. Heals for 3% of max HP per point when taking damage. Lasts 10 seconds. 45-second cooldown (reduced by 3 seconds per point). (passive_effect: castable Earth Shield with healing, 3% max HP per point, 10s duration, 45s base cooldown, -3s per point, max 15% max HP heal + 30s cooldown at 5 points)
5. **Skill 5** (Lv 13): **Nature's Wrath** - Increases all nature damage dealt by 8% per point. Thorns reflect damage is considered nature damage and benefits from this bonus. (damage_mult: +8% nature damage per point, max 40% at 5 points)
6. **Skill 6** (Lv 15): **Regrowth** - Passive nature-based healing over time. Heals for 0.5% of max HP per second per point. (passive_effect: passive HoT, 0.5% max HP per second per point, max 2.5% per second at 5 points)
7. **Skill 7** (Lv 17): **Bark Skin** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
8. **Skill 8** (Lv 19): **Plant Growth** - AoE heal that heals all party members for 4% of max HP per point. If the Warden is affected by Earth Shield when cast, the Warden receives 100% additional healing per point. 25-second cooldown (reduced by 2 seconds per point). (passive_effect: AoE heal with Earth Shield synergy, 4% max HP per point, +100% healing per point if Earth Shield active, 25s base cooldown, -2s per point, max 20% party heal + 500% Warden bonus + 15s cooldown at 5 points)
9. **Skill 9** (Lv 21): **Wild One** - Enters a nature state granting increased dodge chance. Gains 3 charges per point. Each dodge consumes 1 charge and deals nature damage equal to 15% of attack power per point to the attacker, with a 10% chance per point to poison for 5 seconds. 40-second cooldown (reduced by 3 seconds per point). (passive_effect: nature state with dodge + damage, 3 charges per point, 15% attack power per point, 10% poison chance per point, 40s base cooldown, -3s per point, max 15 charges + 75% damage + 50% poison chance + 25s cooldown at 5 points)
10. **Skill 10** (Lv 23): **Toxic Nature** - Increases poison damage by 10% per point and generates threat equal to 30% of poison damage dealt per point. (passive_effect: poison damage enhancement + threat, 10% poison damage per point, 30% threat per point, max 50% damage + 150% threat at 5 points)
11. **Skill 11** (Lv 25): **Iron Bark** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
12. **Skill 12** (Lv 27): **Bark Armor** - Each time the Warden takes damage, defense increases by 1% per point, stacking up to 5 stacks per point. Stacks last 8 seconds and refresh on new damage. (passive_effect: stacking defense on damage, 1% defense per stack per point, 5 stacks max per point, 8s duration, max 5% per stack + 25 stacks max at 5 points)
13. **Skill 13** (Lv 29): **Wild Fury** - While Wild One is active, the Warden deals 10% more nature damage per point and generates threat equal to 20% of all damage dealt per point. (passive_effect: Wild One while-active bonus, +10% nature damage per point, +20% threat generation per point, max +50% nature damage + 100% threat at 5 points)
14. **Skill 14** (Lv 31): **Plant Growth Mastery** - Enhances Plant Growth to grant all party members 2 stacks per point of nature damage bonus. Each stack grants +5% nature damage per point for the next 3 attacks per point. (passive_effect: Plant Growth enhancement, 2 stacks per point, +5% nature damage per stack per point, 3 attacks per stack per point, max 10 stacks + 25% damage per stack + 15 attacks per stack at 5 points)
15. **Skill 15** (Lv 33): **Nature's Retribution** - While taking damage, Thorns reflect damage is increased by 2% per point and generates threat equal to 25% of damage reflected per point. (ability_enhance: Thorns enhancement while taking damage, +2% reflect damage per point, +25% threat per point, max +10% reflect + 125% threat at 5 points)
16. **Skill 16** (Lv 35): **Nature's Embrace** - All attacks deal additional nature damage equal to 8% of attack power per point. This nature damage benefits from all nature damage bonuses and threat generation. (passive_effect: passive nature damage on all attacks, 8% attack power per point, max 40% at 5 points)
17. **Skill 17** (Lv 37): **Primal Guardian** - While Thorns is active (always), the Warden gains healing equal to 3% of all nature damage dealt per point and generates threat equal to 20% of all nature damage dealt per point. (passive_effect: ultimate synergy, 3% nature damage to healing per point, 20% threat per point, max 15% healing + 100% threat at 5 points)
17. **Skill 17** (Lv 37): **Primal Guardian** - While Thorns is active (always), the Warden gains healing equal to 3% of all nature damage dealt per point and generates threat equal to 20% of all nature damage dealt per point. (passive_effect: ultimate synergy, 3% nature damage to healing per point, 20% threat per point, max 15% healing + 100% threat at 5 points)

**Ideas**:
- Thorns reflect damage increase
- Nature-based healing over time
- Damage reduction when taking multiple hits
- Root/entangle effects
- Nature damage bonuses

---

### 4. Blood Knight 🩸
**Theme**: Life-stealing tank with self-sustain
**Primary Ability**: Blood Drain - Steals 50% of damage dealt back as HP for 10 seconds
**Playstyle**: Best when healers need to focus on party, tank can sustain self

**Skill Tree Focus**: Lifesteal, self-healing, blood magic themes

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Blood Drain Mastery** - Increases Blood Drain duration by +0.5 seconds per point and reduces Blood Drain cooldown by 2% per point. (ability_enhance: +0.5s duration, -2% cooldown per point, max +2.5s duration + -10% cooldown at 5 points)
2. **Skill 2** (Lv 7): **Sanguine Power** - Increases Blood Drain lifesteal effectiveness by +2% per point (from base 50%). (ability_enhance: +2% lifesteal per point, max +10% at 5 points)
3. **Skill 3** (Lv 9): **Vampiric Aura** - Provides permanent lifesteal of 2% per point. All damage dealt heals for this percentage. (passive_effect: permanent lifesteal, 2% per point, max 10% at 5 points)
4. **Skill 4** (Lv 11): **Blood Rage** - When HP drops below 30%, damage dealt is increased by 5% per point. (passive_effect: low HP damage bonus, 5% per point at <30% HP, max 25% at 5 points)
5. **Skill 5** (Lv 13): **Iron Will** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
6. **Skill 6** (Lv 15): **Blood Magic** - Increases all damage dealt by 4% per point. This damage is considered blood magic and benefits from blood magic bonuses. (damage_mult: +4% damage per point, max 20% at 5 points)
7. **Skill 7** (Lv 17): **Blood Rush** - When HP drops below 30%, all healing received is increased by 8% per point. (passive_effect: low HP healing bonus, 8% per point at <30% HP, max 40% at 5 points)
8. **Skill 8** (Lv 19): **Hemorrhage** - While Blood Drain is active, attacks have a 10% chance per point to cause bleeding, dealing damage over time equal to 3% of attack power per point per second for 5 seconds. (ability_enhance: bleeding DoT during Blood Drain, 10% chance per point, 3% attack power per point, max 50% chance + 15% per second at 5 points)
9. **Skill 9** (Lv 21): **Blood Shield** - Overhealing from lifesteal creates a blood shield equal to 10% of overheal per point. Blood shield absorbs damage up to 20% of max HP per point. (passive_effect: blood shield from overheal, 10% overheal per point, 20% max HP per point shield cap, max 50% overheal + 100% max HP shield at 5 points)
10. **Skill 10** (Lv 23): **Blood Armor** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
11. **Skill 11** (Lv 25): **Blood Frenzy** - While Blood Drain is active, attacks have a 5% chance per point to trigger an additional attack, and threat generation is increased by 15% per point. (ability_enhance: extra attack chance + threat during Blood Drain, 5% chance per point, 15% threat per point, max 25% chance + 75% threat at 5 points)
12. **Skill 12** (Lv 27): **Sanguine Mastery** - All blood magic damage deals 8% more damage per point and generates threat equal to 20% of damage dealt per point. (passive_effect: blood magic enhancement, 8% damage per point, 20% threat per point, max 40% damage + 100% threat at 5 points)
13. **Skill 13** (Lv 29): **Last Stand** - When HP drops below 20%, damage taken is reduced by 8% per point and all lifesteal is increased by 10% per point for 5 seconds. 60-second cooldown. (passive_effect: low HP survival, 8% damage reduction per point, 10% lifesteal bonus per point, max 40% reduction + 50% lifesteal at 5 points)
14. **Skill 14** (Lv 31): **Blood Pact** - While Blood Drain is active, the Blood Knight takes 3% less damage per point, and all lifesteal heals for 5% more per point. (ability_enhance: Blood Drain defensive bonus, 3% damage reduction per point, 5% lifesteal bonus per point, max 15% reduction + 25% lifesteal at 5 points)
15. **Skill 15** (Lv 33): **Blood Lord** - All damage dealt has a 5% chance per point to deal additional blood magic damage equal to 10% of attack power per point. Additionally, all lifesteal effects are increased by 5% per point. (passive_effect: blood magic capstone, 5% chance per point, 10% attack power per point, 5% lifesteal bonus per point, max 25% chance + 50% damage + 25% lifesteal at 5 points)

**Ideas**:
- Blood Drain effectiveness increase
- Blood Drain cooldown reduction
- Permanent lifesteal percentage
- Low HP damage/healing bonuses
- Blood magic damage bonuses

---

### 5. Vanguard (Agile Vanguard) ⚡
**Theme**: Mobile tank with evasion
**Primary Ability**: Evasion - 50% chance to dodge all attacks for 6 seconds
**Playstyle**: Best against fast-attacking enemies or multi-enemy encounters

**Skill Tree Focus**: Dodge/evasion, mobility, speed-based tanking

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Evasion Mastery** - Increases Evasion duration by +0.5 seconds per point and reduces Evasion cooldown by 2% per point. (ability_enhance: +0.5s duration, -2% cooldown per point, max +2.5s + -10% at 5 points)
2. **Skill 2** (Lv 7): **Dodge Chance** - Increases Evasion dodge chance by +3% per point (from base 50%). (ability_enhance: +3% per point, max +15% at 5 points)
3. **Skill 3** (Lv 9): **Nimble Reflexes** - Provides passive dodge chance of 2% per point. All attacks have this chance to be dodged. (passive_effect: passive dodge, 2% per point, max 10% at 5 points)
4. **Skill 4** (Lv 11): **Swift Counter** - When successfully dodging, has a 10% chance per point to trigger an immediate counterattack dealing 30% of attack power per point. (passive_effect: counterattack on dodge, 10% chance per point, 30% attack power per point, max 50% chance + 150% damage at 5 points)
5. **Skill 5** (Lv 13): **Agile Frame** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
6. **Skill 6** (Lv 15): **Blinding Speed** - While Evasion is active, attacks have a 5% chance per point to trigger an additional attack, and threat generation is increased by 15% per point. (ability_enhance: extra attack chance + threat during Evasion, 5% chance per point, 15% threat per point, max 25% chance + 75% threat at 5 points)
7. **Skill 7** (Lv 17): **Dance of Blades** - Each successful dodge increases attack power by 2% per point for 5 seconds, stacking up to 3 stacks per point. (passive_effect: attack power stacking on dodge, 2% attack per stack per point, 3 stacks max per point, max 10% per stack + 15 stacks at 5 points)
8. **Skill 8** (Lv 19): **Wind Walker** - Increases attack power by 4% per point. (stat_boost: +4% attack per point, max 20% at 5 points)
9. **Skill 9** (Lv 21): **Evasive Maneuvers** - When HP drops below 30%, dodge chance is increased by 3% per point and all damage taken is reduced by 2% per point. (passive_effect: low HP dodge + damage reduction, 3% dodge per point, 2% damage reduction per point at <30% HP, max 15% dodge + 10% reduction at 5 points)
10. **Skill 10** (Lv 23): **Lightning Reflexes** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
11. **Skill 11** (Lv 25): **Riposte** - While Evasion is active, successful dodges deal damage equal to 25% of attack power per point back to the attacker. (ability_enhance: dodge damage reflect during Evasion, 25% attack power per point, max 125% at 5 points)
12. **Skill 12** (Lv 27): **Fleet Footed** - Each successful dodge reduces all ability cooldowns by 0.5 seconds per point. (passive_effect: cooldown reduction on dodge, 0.5s per dodge per point, max 2.5s at 5 points)
13. **Skill 13** (Lv 29): **Blade Storm** - While Evasion is active, the Vanguard deals 8% more damage per point and generates threat equal to 20% of all damage dealt per point. (ability_enhance: damage + threat during Evasion, +8% damage per point, +20% threat per point, max +40% damage + 100% threat at 5 points)
14. **Skill 14** (Lv 31): **Untouchable** - When successfully dodging, grants a stacking damage reduction buff of 1% per point for 3 seconds, stacking up to 5 stacks per point. (passive_effect: stacking damage reduction on dodge, 1% per stack per point, 5 stacks max per point, max 5% per stack + 25 stacks at 5 points)
15. **Skill 15** (Lv 33): **Master of Evasion** - All dodge effects are enhanced by 10% per point. Additionally, when Evasion ends, grants a brief dodge chance bonus of 5% per point for 3 seconds. (passive_effect: dodge enhancement capstone, 10% enhancement per point, 5% bonus dodge per point for 3s, max 50% enhancement + 25% bonus at 5 points)

---

### 6. Brewmaster (Brewed Monk) 🍺
**Theme**: Stagger tank with delayed damage
**Primary Ability**: Stagger - All damage reduced by 40% immediately, remaining 60% taken over 8 seconds as DoT (Passive)
**Playstyle**: Best for progression content, gives healers time to react

**Skill Tree Focus**: Stagger effectiveness, DoT management, delayed damage mitigation

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Stagger Mastery** - Increases Stagger damage reduction by +2% per point (from base 40%). (ability_enhance: +2% damage reduction per point, max +10% at 5 points)
2. **Skill 2** (Lv 7): **Purifying Brew** - Active ability that clears 20% of remaining Stagger DoT per point. 30-second cooldown (reduced by 2 seconds per point). (passive_effect: active DoT cleanse, 20% DoT cleared per point, 30s base cooldown, -2s per point, max 100% cleared + 20s cooldown at 5 points)
3. **Skill 3** (Lv 9): **Fortifying Brew** - Increases maximum HP by 5% per point. (stat_boost: +5% HP per point, max 25% at 5 points)
4. **Skill 4** (Lv 11): **Celestial Brew** - Converts 5% of Stagger DoT damage per point into healing over time. (passive_effect: DoT to healing conversion, 5% DoT to healing per point, max 25% at 5 points)
5. **Skill 5** (Lv 13): **Iron Skin Brew** - Increases defense by 6% per point. (stat_boost: +6% defense per point, max 30% at 5 points)
6. **Skill 6** (Lv 15): **Stagger Absorption** - Reduces Stagger DoT duration by 1 second per point. (ability_enhance: DoT duration reduction, -1s per point, max -5s at 5 points)
7. **Skill 7** (Lv 17): **Breath of Fire** - While Stagger DoT is active, attacks have a 15% chance per point to deal fire damage equal to 10% of attack power per point to all nearby enemies. (passive_effect: fire AoE during Stagger DoT, 15% chance per point, 10% attack power per point, max 75% chance + 50% damage at 5 points)
8. **Skill 8** (Lv 19): **Keg Smash** - Active ability that deals damage equal to 30% of attack power per point and reduces enemy attack damage by 3% per point for 8 seconds. Generates threat equal to 50% of damage dealt per point. 20-second cooldown (reduced by 1 second per point). (passive_effect: active AoE damage + debuff, 30% attack power per point, 3% attack reduction per point, 50% threat per point, 20s base cooldown, -1s per point, max 150% damage + 15% reduction + 250% threat + 15s cooldown at 5 points)
9. **Skill 9** (Lv 21): **Stagger Resilience** - While Stagger DoT is active, all healing received is increased by 5% per point. (passive_effect: healing bonus during Stagger DoT, 5% per point, max 25% at 5 points)
10. **Skill 10** (Lv 23): **Blackout Strike** - Attacks have a 10% chance per point to deal bonus damage equal to 15% of attack power per point and generate threat equal to 30% of the bonus damage per point. (passive_effect: chance for bonus damage + threat, 10% chance per point, 15% attack power per point, 30% threat per point, max 50% chance + 75% damage + 150% threat at 5 points)
11. **Skill 11** (Lv 25): **Celestial Harmony** - While Stagger DoT is active, the Brewmaster takes 2% less damage per point from all sources. (passive_effect: damage reduction during Stagger DoT, 2% per point, max 10% at 5 points)
12. **Skill 12** (Lv 27): **Brew Mastery** - All brew abilities (Purifying Brew, Celestial Brew) have their effectiveness increased by 10% per point and cooldowns reduced by an additional 5% per point. (passive_effect: brew enhancement, 10% effectiveness per point, 5% cooldown reduction per point, max 50% effectiveness + 25% cooldown at 5 points)
13. **Skill 13** (Lv 29): **Staggered Steps** - While Stagger DoT is active, the Brewmaster deals 6% more damage per point and generates threat equal to 15% of all damage dealt per point. (passive_effect: damage + threat during Stagger DoT, +6% damage per point, +15% threat per point, max +30% damage + 75% threat at 5 points)
14. **Skill 14** (Lv 31): **Iron Body** - Increases defense effectiveness by 5% per point. Each point of defense provides additional damage reduction. (defense_mult: +5% defense effectiveness per point, max 25% at 5 points)
15. **Skill 15** (Lv 33): **Master Brew** - Stagger DoT damage is reduced by an additional 5% per point, and all Stagger-related effects are enhanced by 10% per point. (passive_effect: Stagger capstone, 5% DoT reduction per point, 10% enhancement per point, max 25% reduction + 50% enhancement at 5 points)

---

## HEALER CLASSES (8 Classes)

### 7. Cleric 💚
**Theme**: Balanced healer with resurrection
**Primary Ability**: Combat Resurrection - Resurrects a dead ally with 50% HP
**Playstyle**: Versatile healer for all content, essential for difficult encounters

**Skill Tree Focus**: Resurrection enhancement, balanced healing, versatility

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Combat Resurrection Mastery** - Increases Combat Resurrection HP restored by +5% per point (from base 50%) and reduces cooldown by 3% per point. (ability_enhance: +5% HP per point, -3% cooldown per point, max +25% HP + -15% cooldown at 5 points)
2. **Skill 2** (Lv 7): **Greater Heal** - Active ability that heals a target for 15% of their max HP per point. 25-second cooldown (reduced by 2 seconds per point). (passive_effect: active single-target heal, 15% max HP per point, 25s base cooldown, -2s per point, max 75% HP + 15s cooldown at 5 points)
3. **Skill 3** (Lv 9): **Divine Blessing** - Increases all healing done by 4% per point. (healing_mult: +4% healing per point, max 20% at 5 points)
4. **Skill 4** (Lv 11): **Prayer of Healing** - Active ability that heals all party members for 8% of max HP per point. 30-second cooldown (reduced by 2 seconds per point). (passive_effect: active AoE heal, 8% max HP per point, 30s base cooldown, -2s per point, max 40% HP + 20s cooldown at 5 points)
5. **Skill 5** (Lv 13): **Mana Efficiency** - Reduces mana costs of all abilities by 3% per point. (passive_effect: mana cost reduction, 3% per point, max 15% at 5 points)
6. **Skill 6** (Lv 15): **Renew** - Active ability that applies a heal over time restoring 2% of max HP per second per point for 12 seconds. 20-second cooldown (reduced by 1 second per point). (passive_effect: active HoT, 2% max HP per second per point, 12s duration, 20s base cooldown, -1s per point, max 10% per second + 15s cooldown at 5 points)
7. **Skill 7** (Lv 17): **Divine Shield** - When healing an ally below 30% HP, grants them a shield equal to 10% of healing done per point for 5 seconds. (passive_effect: healing to shield conversion, 10% healing to shield per point, max 50% at 5 points)
8. **Skill 8** (Lv 19): **Power Word: Fortitude** - Active ability that increases target's maximum HP by 5% per point for 60 seconds. 90-second cooldown (reduced by 5 seconds per point). (passive_effect: active HP boost buff, 5% max HP per point, 90s base cooldown, -5s per point, max 25% HP + 65s cooldown at 5 points)
9. **Skill 9** (Lv 21): **Circle of Healing** - When casting any single-target heal, heals 3 additional nearby allies for 30% of the original heal per point. (passive_effect: heal splash effect, 30% heal to nearby allies per point, max 150% at 5 points)
10. **Skill 10** (Lv 23): **Divine Haste** - When an ally is resurrected, they gain 10% increased damage and healing per point for 15 seconds. (passive_effect: resurrection buff, 10% damage + healing per point, max 50% at 5 points)
11. **Skill 11** (Lv 25): **Mana Spring** - Restores mana equal to 1% of max mana per second per point. (passive_effect: passive mana regen, 1% max mana per second per point, max 5% at 5 points)
12. **Skill 12** (Lv 27): **Resurrection Mastery** - Combat Resurrection now restores 5% additional HP per point and reduces resurrection sickness duration by 10% per point. (ability_enhance: resurrection enhancement, +5% HP per point, -10% sickness per point, max +25% HP + -50% sickness at 5 points)
13. **Skill 13** (Lv 29): **Emergency Heal** - When an ally drops below 20% HP, has a 20% chance per point to instantly heal them for 15% of max HP per point. 60-second cooldown per target. (passive_effect: emergency heal proc, 20% chance per point, 15% max HP per point, max 100% chance + 75% HP at 5 points)
14. **Skill 14** (Lv 31): **Divine Radiance** - All healing done below 50% target HP is increased by 6% per point. (healing_mult: +6% healing bonus per point, max 30% at 5 points)
15. **Skill 15** (Lv 33): **Master Healer** - All healing effects are enhanced by 8% per point, and Combat Resurrection cooldown is reduced by an additional 5% per point. (passive_effect: healing capstone, 8% enhancement per point, 5% cooldown reduction per point, max 40% enhancement + 25% cooldown at 5 points)

---

### 8. Atoner ⚖️
**Theme**: Offensive healer who heals through damage
**Primary Ability**: Atonement - 30% of damage dealt converts to healing on party members (Passive)
**Playstyle**: High DPS healer, best with strong tank and when party is healthy

**Skill Tree Focus**: Damage-to-healing conversion, offensive healing, hybrid playstyle

**Proposed Skills**:
1. **Skill 1** (Lv 5): **Atonement Mastery** - Increases Atonement conversion percentage by +2% per point (from base 30%). (ability_enhance: +2% conversion per point, max +10% at 5 points)
2. **Skill 2** (Lv 7): **Penance** - Active ability that deals damage equal to 25% of attack power per point and converts 50% of damage to healing split among all injured party members. 20-second cooldown (reduced by 1 second per point). (passive_effect: active damage + healing, 25% attack power per point, 50% to healing, 20s base cooldown, -1s per point, max 125% damage + 18s cooldown at 5 points)
3. **Skill 3** (Lv 9): **Smite** - Increases all damage dealt by 5% per point. (damage_mult: +5% damage per point, max 25% at 5 points)
4. **Skill 4** (Lv 11): **Power Word: Solace** - Attacks have a 15% chance per point to restore mana equal to 2% of max mana per point. (passive_effect: mana restore on attack, 15% chance per point, 2% max mana per point, max 75% chance + 10% mana at 5 points)
5. **Skill 5** (Lv 13): **Penitent Strikes** - Attacks have a 10% chance per point to deal bonus damage equal to 20% of attack power per point, and 50% of bonus damage converts to healing. (passive_effect: bonus damage + healing, 10% chance per point, 20% attack power per point, max 50% chance + 100% damage at 5 points)
6. **Skill 6** (Lv 15): **Divine Wrath** - Increases critical hit chance by 3% per point and critical hit damage by 5% per point. (passive_effect: crit enhancement, 3% crit chance per point, 5% crit damage per point, max 15% chance + 25% damage at 5 points)
7. **Skill 7** (Lv 17): **Atonement Burst** - When Atonement healing exceeds 50% of an ally's max HP in 5 seconds, triggers a burst heal equal to 10% of max HP per point. 30-second cooldown per target. (passive_effect: burst heal proc, 10% max HP per point, max 50% at 5 points)
8. **Skill 8** (Lv 19): **Hybrid Power** - Increases attack power by 4% per point and healing done by 4% per point. (stat_boost: +4% attack per point, +4% healing per point, max +20% attack + 20% healing at 5 points)
9. **Skill 9** (Lv 21): **Shadow Word: Pain** - Attacks apply a DoT dealing 3% of attack power per point per second for 8 seconds. 50% of DoT damage converts to healing. (passive_effect: DoT with healing conversion, 3% attack power per point, 8s duration, max 15% per second at 5 points)
10. **Skill 10** (Lv 23): **Purge** - Active ability that deals damage equal to 30% of attack power per point and removes one debuff from target. If debuff is removed, converts 100% of damage to healing. 25-second cooldown (reduced by 2 seconds per point). (passive_effect: active damage + debuff removal, 30% attack power per point, 25s base cooldown, -2s per point, max 150% damage + 17s cooldown at 5 points)
11. **Skill 11** (Lv 25): **Atonement Aura** - While Atonement is active (always), all damage dealt is increased by 3% per point and Atonement conversion is increased by 1% per point. (passive_effect: atonement enhancement, +3% damage per point, +1% conversion per point, max +15% damage + 5% conversion at 5 points)
12. **Skill 12** (Lv 27): **Power Infusion** - Active ability that increases target's damage and healing by 15% per point for 15 seconds. 60-second cooldown (reduced by 3 seconds per point). (passive_effect: active buff, 15% damage + healing per point, 60s base cooldown, -3s per point, max 75% + 45s cooldown at 5 points)
13. **Skill 13** (Lv 29): **Divine Strike** - Attacks have a 15% chance per point to deal bonus damage equal to 30% of attack power per point. All bonus damage converts to healing at 150% effectiveness. (passive_effect: bonus damage + healing, 15% chance per point, 30% attack power per point, max 75% chance + 150% damage at 5 points)
14. **Skill 14** (Lv 31): **Atonement Mastery** - Atonement healing is increased by 10% per point, and critical hits with Atonement heal for an additional 50% per point. (ability_enhance: atonement enhancement, 10% healing bonus per point, 50% crit healing bonus per point, max 50% bonus + 250% crit at 5 points)
15. **Skill 15** (Lv 33): **Perfect Balance** - All damage and healing effects are enhanced by 6% per point. Additionally, Atonement conversion is increased by an additional 2% per point. (passive_effect: hybrid capstone, 6% enhancement per point, +2% conversion per point, max 30% enhancement + 10% conversion at 5 points)

---

### 9. Druid (Restoration Druid) 🌱
**Theme**: HoT specialist with nature healing
**Primary Ability**: Wild Growth - Heals all party members over 12 seconds
**Playstyle**: Best for sustained AoE healing, excels in longer fights

**Skill Tree Focus**: HoT effectiveness, over-time healing, nature themes

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Wild Growth duration/healing increase
- HoT stacking effects
- Nature-based healing bonuses
- Regeneration effects
- Long-term healing bonuses

---

### 10. Lightbringer ☀️
**Theme**: Beacon healer with smart healing
**Primary Ability**: Beacon of Light - 40% of healing done to tank also heals the lowest HP ally (Passive)
**Playstyle**: Efficient tank healer, excellent mana efficiency

**Skill Tree Focus**: Beacon enhancement, efficient healing, smart healing distribution

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Beacon transfer percentage increase
- Mana efficiency bonuses
- Smart healing bonuses
- Light-based healing power
- Multi-target healing efficiency

---

### 11. Shaman (Spirit Healer) 🔱
**Theme**: Spiritual healer with chain heals
**Primary Ability**: Chain Heal - Heals primary target and bounces to 3 other injured allies
**Playstyle**: Best for spread damage healing, excellent in large groups

**Skill Tree Focus**: Chain Heal enhancement, multi-target healing, spirit themes

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Chain Heal bounce count increase
- Chain Heal healing per bounce
- Chain Heal cooldown reduction
- Multi-target healing bonuses
- Spirit-based effects

---

### 12. Mistweaver 🌫️
**Theme**: Mobile healer with channeled healing
**Primary Ability**: Soothing Mist - Continuously heals lowest HP ally for 1% max HP per second (Passive)
**Playstyle**: Constant background healing, good for topping off party

**Skill Tree Focus**: Continuous healing, channeled healing enhancement, mobility

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Soothing Mist healing rate increase
- Soothing Mist target count increase
- Channeled healing bonuses
- Mobility bonuses
- Continuous healing efficiency

---

### 13. Chronomancer (Chronomender) ⏰
**Theme**: Time mage with HP rewind
**Primary Ability**: Temporal Rewind - Restores all allies to their HP 8 seconds ago
**Playstyle**: Ultimate progression healer, can undo wipe mechanics

**Skill Tree Focus**: Temporal Rewind enhancement, time manipulation, emergency recovery

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Temporal Rewind lookback time increase
- Temporal Rewind cooldown reduction
- Time-based healing bonuses
- Cooldown reduction (time manipulation)
- Emergency recovery bonuses

---

### 14. Bard 🎵
**Theme**: Support healer who buffs allies with musical magic
**Primary Ability**: Battle Hymn - Buffs all party members with +15% attack and +10% defense (scales with intellect)
**Playstyle**: Best for party-wide buffs and sustained support, buffs scale with gear

**Skill Tree Focus**: Battle Hymn enhancement, buff effectiveness, support abilities

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Battle Hymn buff effectiveness increase
- Battle Hymn duration increase
- Battle Hymn cooldown reduction
- Healing Melody enhancement (secondary ability)
- Musical/buff theme bonuses

---

## DPS CLASSES (16 Classes)

### 15. Berserker ⚔️
**Theme**: Rage-fueled melee with execute damage
**Primary Ability**: Enrage - +50% attack damage for 12 seconds when enemy drops below 30% HP
**Playstyle**: High burst DPS, excels at finishing low HP targets

**Skill Tree Focus**: Execute damage, burst damage, low HP bonuses

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Enrage damage bonus increase
- Execute damage bonuses
- Low HP target damage bonuses
- Rage-based mechanics
- Burst damage bonuses

---

### 16. Crusader 🗡️
**Theme**: Holy warrior with smite damage
**Primary Ability**: Divine Storm - Deals 200% weapon damage to all enemies (proc-based, every 8 attacks)
**Playstyle**: Strong AoE damage, excellent in multi-target fights

**Skill Tree Focus**: AoE damage, holy damage, multi-target effectiveness

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Divine Storm damage increase
- Divine Storm proc chance/rate
- AoE damage bonuses
- Holy damage bonuses
- Multi-target effectiveness

---

### 17. Assassin 🗝️
**Theme**: Stealth striker with critical hits
**Primary Ability**: Backstab - 25% chance to deal 300% critical damage (Passive)
**Playstyle**: Highest single-target burst, RNG-based damage spikes

**Skill Tree Focus**: Critical hit chance, critical damage, single-target burst

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Backstab proc chance increase
- Backstab critical damage increase
- Critical hit chance bonuses
- Critical damage bonuses
- Single-target damage bonuses

---

### 18. Reaper 💀
**Theme**: Death knight with DoT damage
**Primary Ability**: Soul Harvest - Attacks apply Soul Reap DoT (10 damage/second for 10 seconds)
**Playstyle**: Strong sustained DPS through damage over time

**Skill Tree Focus**: DoT damage, DoT duration, death/shadow themes

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Soul Reap DoT damage increase
- Soul Reap DoT duration increase
- DoT stacking effects
- Shadow/death damage bonuses
- Sustained damage bonuses

---

### 19. Bladedancer 💃
**Theme**: Agile melee with quick strikes
**Primary Ability**: Whirlwind - Hits all enemies for 150% damage (proc-based, every 6 attacks)
**Playstyle**: Consistent AoE pressure, good for cleave damage

**Skill Tree Focus**: Attack speed, AoE damage, mobility

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Whirlwind damage increase
- Whirlwind proc rate
- Attack speed bonuses
- AoE damage bonuses
- Mobility/agility bonuses

---

### 20. Monk (Chi Fighter) 🥋
**Theme**: Martial artist with combo attacks
**Primary Ability**: Rising Sun Kick - Builds combo points, big finisher at 5 stacks
**Playstyle**: Ramp-up damage, stronger in longer fights

**Skill Tree Focus**: Combo point generation, finisher damage, sustained DPS

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Combo point generation rate
- Finisher damage increase
- Combo point bonuses
- Martial arts themed bonuses
- Ramp-up damage bonuses

---

### 21. Storm Warrior ⚡
**Theme**: Lightning-infused warrior
**Primary Ability**: Thunderstrike - 20% chance to chain lightning to 2 additional targets
**Playstyle**: Good cleave damage with lightning procs

**Skill Tree Focus**: Lightning chain effects, cleave damage, proc rates

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Thunderstrike proc chance
- Chain lightning target count
- Lightning damage bonuses
- Cleave damage bonuses
- Proc-based damage bonuses

---

### 22. Hunter (Beast Stalker) 🏹
**Theme**: Pet master with ranged attacks
**Primary Ability**: Call Pet - Summons pet that deals 30% of your attack as additional damage
**Playstyle**: Sustained damage through pet, good for solo content

**Skill Tree Focus**: Pet damage, pet effectiveness, ranged damage

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Pet damage percentage increase
- Pet duration increase
- Pet attack speed
- Ranged damage bonuses
- Beast/mastery themes

---

### 23. Mage (Elementalist) 🔮
**Theme**: Arcane caster with elemental rotation
**Primary Ability**: Elemental Mastery - Rotates elements (Fire/Frost/Arcane), each with unique effects
**Playstyle**: Highest magic DPS, requires good positioning

**Skill Tree Focus**: Elemental damage, rotation bonuses, magic power

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Elemental rotation bonuses
- Fire/Frost/Arcane specific bonuses
- Magic damage bonuses
- Elemental mastery effects
- Cast speed bonuses

---

### 24. Warlock 😈
**Theme**: Demon summoner with shadow magic
**Primary Ability**: Summon Demon - Summons demon dealing 35% of attack as shadow damage
**Playstyle**: Strong DoT damage plus demon pet

**Skill Tree Focus**: Demon pet effectiveness, shadow damage, DoT effects

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Demon damage percentage increase
- Demon duration increase
- Shadow damage bonuses
- DoT damage bonuses
- Demon/summoning themes

---

### 25. Ranger (Marksman) 🏹
**Theme**: Precision archer with aimed shots
**Primary Ability**: Aimed Shot - 15% chance to deal 250% critical damage
**Playstyle**: Consistent ranged DPS with crit burst

**Skill Tree Focus**: Critical hit chance, ranged damage, precision/accuracy

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Aimed Shot proc chance
- Aimed Shot critical damage
- Ranged damage bonuses
- Critical hit bonuses
- Precision/accuracy bonuses

---

### 26. Shadow Priest (Dark Oracle) 🌑
**Theme**: Shadow caster with mind damage
**Primary Ability**: Shadow Word: Death - Deals massive damage to targets below 20% HP
**Playstyle**: Execute specialist, strong finisher

**Skill Tree Focus**: Execute damage, shadow damage, low HP target bonuses

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Shadow Word: Death damage increase
- Execute threshold increase
- Shadow damage bonuses
- Low HP target damage bonuses
- Mind/shadow themed bonuses

---

### 27. Mooncaller 🌙
**Theme**: Lunar/solar balance druid
**Primary Ability**: Eclipse - Alternates Solar (burst) and Lunar (DoT) forms
**Playstyle**: Hybrid burst and sustained damage

**Skill Tree Focus**: Eclipse form bonuses, balance between burst and DoT

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Solar form burst damage
- Lunar form DoT damage
- Eclipse form transition bonuses
- Balance-themed bonuses
- Hybrid damage bonuses

---

### 28. Stormcaller ⛈️
**Theme**: Lightning mage with chain damage
**Primary Ability**: Chain Lightning - 30% chance to hit 3 additional targets with lightning
**Playstyle**: Excellent multi-target DPS

**Skill Tree Focus**: Chain lightning effectiveness, multi-target damage, lightning themes

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Chain Lightning proc chance
- Chain Lightning target count
- Lightning damage bonuses
- Multi-target damage bonuses
- Storm/lightning themed bonuses

---

### 29. Necromancer 💀
**Theme**: Death mage who raises undead minions
**Primary Ability**: Raise Dead - Summons undead minion dealing 40% of attack as shadow damage
**Playstyle**: Strong DoT damage plus undead pet

**Skill Tree Focus**: Undead minion effectiveness, shadow/death damage, summoning

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Undead minion damage increase
- Undead minion duration
- Shadow/death damage bonuses
- DoT damage bonuses
- Necromancy/undead themes

---

### 30. Frostmage (Frost Invoker) ❄️
**Theme**: Frost specialist with slowing effects
**Primary Ability**: Frost Mastery - Attacks slow enemies and deal bonus frost damage
**Playstyle**: Controlled damage with utility, good for kiting

**Skill Tree Focus**: Frost damage, slow effects, control/utility

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Frost damage bonuses
- Slow effectiveness increase
- Control/utility bonuses
- Frost-themed effects
- Kiting bonuses

---

### 31. Firemage (Pyroclast) 🔥
**Theme**: Fire specialist with explosive damage
**Primary Ability**: Fire Mastery - Attacks have a chance to ignite enemies with fire DoT
**Playstyle**: Highest fire burst damage, burn damage over time

**Skill Tree Focus**: Fire damage, burn DoT effects, burst damage

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Fire damage bonuses
- Burn DoT damage/duration
- Ignite proc chance
- Burst damage bonuses
- Fire-themed effects

---

### 32. Dragonsorcerer (Draconic Sorcerer) 🐉
**Theme**: Dragon magic caster with fire damage
**Primary Ability**: Dragon Breath - Cone of fire dealing 250% damage to all enemies (proc-based, every 10 attacks)
**Playstyle**: Highest burst AoE, glass cannon

**Skill Tree Focus**: Dragon Breath effectiveness, AoE burst damage, dragon themes

**Proposed Skills** (to be filled in):
1. **Skill 1** (Lv 5): [NAME] - [DESCRIPTION]
2. **Skill 2** (Lv 7): [NAME] - [DESCRIPTION]
3. **Skill 3** (Lv 9): [NAME] - [DESCRIPTION]
4. **Skill 4** (Lv 11): [NAME] - [DESCRIPTION]
5. **Skill 5** (Lv 13): [NAME] - [DESCRIPTION]
6. **Skill 6** (Lv 15): [NAME] - [DESCRIPTION]
7. **Skill 7** (Lv 17): [NAME] - [DESCRIPTION]
8. **Skill 8** (Lv 19): [NAME] - [DESCRIPTION]
9. **Skill 9** (Lv 21): [NAME] - [DESCRIPTION]
10. **Skill 10** (Lv 23): [NAME] - [DESCRIPTION]

**Ideas**:
- Dragon Breath damage increase
- Dragon Breath proc rate
- AoE burst damage bonuses
- Dragon-themed effects
- Fire damage bonuses

---

## Implementation Notes

### Technical Considerations
1. **Skill ID Format**: `${className}_skill_${index}` (e.g., `guardian_skill_1`, `bard_skill_5`)
2. **Skill Unlock Levels**: 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 37
3. **Skill Points Earned**: At levels 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100 (every 2 levels, up to level 100)
4. **Max Points per Skill**: 5
5. **Total Possible Points**: 85 (but limited by level - level 100 = 48 points available, max level 100)

### Files to Update
- **Frontend**: `E:\IdleDnD-Web\src\utils\skillSystem.ts` - Replace `getSkillTree()` with class-specific trees
- **Backend**: `E:\IdleDnD-Backend\src\data\skills.js` - Replace `generateClassSkills()` with class-specific implementation
- Both files should use the same skill definitions for consistency

### Next Steps
1. **Brainstorm Phase**: Fill in each class's 10 skills with creative, thematic ideas
2. **Balance Review**: Ensure all classes feel viable with different strengths
3. **Implementation**: Code the skill trees in both frontend and backend
4. **Testing**: Test each class's skill tree in-game
5. **Iteration**: Adjust based on player feedback and balance needs

---

## Notes Section

Use this space for brainstorming, notes, and ideas as we work through each class:

### Class-Specific Ability Enhancements Needed
- Some skills should directly modify class abilities (duration, cooldown, effectiveness)
- Need to track which abilities can be enhanced for each class
- Consider passive vs active ability enhancements

### Cross-Class Synergies
- Some skills could enhance party composition
- Consider skills that work well with certain other classes
- Avoid skills that make one class required/mandatory

### Balance Considerations
- Ensure all classes are viable at all levels
- Different classes should excel in different scenarios
- Avoid making any single class overpowered

---

**Last Updated**: [Date]
**Status**: Design Phase - Brainstorming Skills







