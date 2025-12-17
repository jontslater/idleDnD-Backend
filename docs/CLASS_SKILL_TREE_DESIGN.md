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
- **10 skills per class** (unlocked at levels 5, 7, 9, 11, 13, 15, 17, 19, 21, 23)
- **5 points max per skill** (total of 50 potential points, but limited by level)
- **Skill points earned at levels**: 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30

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
- Evasion dodge chance increase
- Evasion duration increase
- Base dodge chance (passive)
- Attack speed bonuses
- Mobility/positioning bonuses

---

### 6. Brewmaster (Brewed Monk) 🍺
**Theme**: Stagger tank with delayed damage
**Primary Ability**: Stagger - All damage reduced by 40% immediately, remaining 60% taken over 8 seconds as DoT (Passive)
**Playstyle**: Best for progression content, gives healers time to react

**Skill Tree Focus**: Stagger effectiveness, DoT management, delayed damage mitigation

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
- Stagger damage reduction increase
- Stagger DoT duration increase/decrease
- Stagger DoT damage reduction
- Brew-based healing (cleanse stagger)
- Monk-style combat bonuses

---

## HEALER CLASSES (8 Classes)

### 7. Cleric 💚
**Theme**: Balanced healer with resurrection
**Primary Ability**: Combat Resurrection - Resurrects a dead ally with 50% HP
**Playstyle**: Versatile healer for all content, essential for difficult encounters

**Skill Tree Focus**: Resurrection enhancement, balanced healing, versatility

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
- Resurrection cooldown reduction
- Resurrection HP restored increase
- General healing power
- Mana efficiency
- Emergency healing bonuses

---

### 8. Atoner ⚖️
**Theme**: Offensive healer who heals through damage
**Primary Ability**: Atonement - 30% of damage dealt converts to healing on party members (Passive)
**Playstyle**: High DPS healer, best with strong tank and when party is healthy

**Skill Tree Focus**: Damage-to-healing conversion, offensive healing, hybrid playstyle

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
- Atonement conversion percentage increase
- Damage dealt bonuses
- Attack power increases
- Critical strike bonuses (damage and healing)
- Hybrid stat bonuses

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
2. **Skill Unlock Levels**: 5, 7, 9, 11, 13, 15, 17, 19, 21, 23
3. **Skill Points Earned**: At levels 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30
4. **Max Points per Skill**: 5
5. **Total Possible Points**: 50 (but limited by level - level 30 = 13 points available)

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

