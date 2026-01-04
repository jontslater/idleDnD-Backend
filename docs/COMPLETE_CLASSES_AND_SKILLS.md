# Complete Classes, Subclasses, and Skills Reference

## Overview
This document provides a comprehensive reference of all classes, subclasses, and their associated skills. This is the foundation for implementing subclass-specific skill trees and the upcoming combat system overhaul.

**Total Classes:** 31 (6 Tanks, 8 Healers, 17 DPS)

---

## 🛡️ TANK CLASSES (6)

### 1. Guardian (Shield Guardian) 🛡️
**Key:** `guardian`  
**Category:** Tank  
**Base Stats:** HP: 220 | ATK: 8 | DEF: 18  
**Theme:** Traditional protector with party-wide defense

**Primary Ability:**
- **Shield Wall** (Active)
- Effect: Creates protective barrier reducing party damage by 30% for 8 seconds
- Trigger: When taking damage above 40% of max HP
- Cooldown: 90 seconds

**Current Skills (Category-Based - Shared with all Tanks):**
1. **Fortitude** (Lv 5) - Increases maximum HP (+5% per point)
2. **Iron Will** (Lv 7) - Reduces damage taken (+3% per point)
3. **Shield Mastery** (Lv 9) - Increases defense (+4% per point)
4. **Threat Generation** (Lv 11) - Increases threat generation (+2% per point)
5. **Last Stand** (Lv 13) - Massive damage reduction at low HP (+5% per point)
6. **Taunt Mastery** (Lv 15) - Reduces taunt cooldown (+10% per point)
7. **Armor Expertise** (Lv 17) - Increases armor effectiveness (+6% per point)
8. **Guardian Stance** (Lv 19) - Party-wide damage reduction (+4% per point)
9. **Unbreakable** (Lv 21) - Massive HP increase (+8% per point)
10. **Protector** (Lv 23) - Ultimate tanking skill (+6% per point)

**Planned Subclass-Specific Skills:** TBD

---

### 2. Paladin (Holy Defender) ✨
**Key:** `paladin`  
**Category:** Tank  
**Base Stats:** HP: 200 | ATK: 10 | DEF: 16  
**Theme:** Divine tank with self-cleansing

**Primary Ability:**
- **Divine Shield** (Active)
- Effect: Becomes immune to all damage and cleanses all debuffs for 5 seconds
- Trigger: When HP drops below 15%
- Cooldown: 120 seconds

**Current Skills (Category-Based - Shared with all Tanks):**
Same as Guardian (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 3. Warden (Wild Warden) 🌿
**Key:** `warden`  
**Category:** Tank  
**Base Stats:** HP: 210 | ATK: 9 | DEF: 15  
**Theme:** Nature tank with damage reflection

**Primary Ability:**
- **Thorns** (Passive)
- Effect: Reflects 35% of all damage taken back to attackers
- Trigger: Always active

**Current Skills (Category-Based - Shared with all Tanks):**
Same as Guardian (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 4. Blood Knight 🩸
**Key:** `bloodknight`  
**Category:** Tank  
**Base Stats:** HP: 205 | ATK: 11 | DEF: 14  
**Theme:** Life-stealing tank with self-sustain

**Primary Ability:**
- **Blood Drain** (Active)
- Effect: Steals 50% of damage dealt back as HP for 10 seconds
- Trigger: When HP drops below 40%
- Cooldown: 60 seconds

**Current Skills (Category-Based - Shared with all Tanks):**
Same as Guardian (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 5. Vanguard (Agile Vanguard) ⚡
**Key:** `vanguard`  
**Category:** Tank  
**Base Stats:** HP: 190 | ATK: 12 | DEF: 15  
**Theme:** Mobile tank with evasion

**Primary Ability:**
- **Evasion** (Active)
- Effect: 50% chance to dodge all attacks for 6 seconds
- Trigger: When HP drops below 30%
- Cooldown: 75 seconds

**Current Skills (Category-Based - Shared with all Tanks):**
Same as Guardian (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 6. Brewmaster (Brewed Monk) 🍺
**Key:** `brewmaster`  
**Category:** Tank  
**Base Stats:** HP: 215 | ATK: 8 | DEF: 17  
**Theme:** Stagger tank with delayed damage

**Primary Ability:**
- **Stagger** (Passive)
- Effect: All damage reduced by 40% immediately, remaining 60% taken over 8 seconds as DoT
- Trigger: Always active

**Current Skills (Category-Based - Shared with all Tanks):**
Same as Guardian (see above)

**Planned Subclass-Specific Skills:** TBD

---

## 💚 HEALER CLASSES (8)

### 7. Cleric 💚
**Key:** `cleric`  
**Category:** Healer  
**Base Stats:** HP: 105 | ATK: 6 | DEF: 8  
**Theme:** Balanced healer with resurrection

**Primary Ability:**
- **Combat Resurrection** (Active)
- Effect: Resurrects a dead ally with 50% HP
- Trigger: When ally dies
- Cooldown: 180 seconds

**Current Skills (Category-Based - Shared with all Healers):**
1. **Healing Touch** (Lv 5) - Increases healing done (+5% per point)
2. **Mana Efficiency** (Lv 7) - Reduces spell cooldowns (+8% per point)
3. **Divine Grace** (Lv 9) - Increases healing power (+4% per point)
4. **Rapid Recovery** (Lv 11) - Faster healing casts (+10% per point)
5. **Group Heal** (Lv 13) - Increases AoE healing (+6% per point)
6. **Cleanse** (Lv 15) - Faster debuff removal (+12% per point)
7. **Overheal** (Lv 17) - Overhealing creates shields (+5% per point)
8. **Resurrection Mastery** (Lv 19) - Faster resurrection (+15% per point)
9. **Divine Shield** (Lv 21) - Protective aura (+3% per point)
10. **Master Healer** (Lv 23) - Ultimate healing skill (+8% per point)

**Planned Subclass-Specific Skills:** TBD

---

### 8. Atoner ⚖️
**Key:** `atoner`  
**Category:** Healer  
**Base Stats:** HP: 100 | ATK: 8 | DEF: 7  
**Theme:** Offensive healer who heals through damage

**Primary Ability:**
- **Atonement** (Passive)
- Effect: 30% of damage dealt converts to healing on party members
- Trigger: Always active

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 9. Druid (Restoration Druid) 🌱
**Key:** `druid`  
**Category:** Healer  
**Base Stats:** HP: 95 | ATK: 5 | DEF: 6  
**Theme:** HoT specialist with nature healing

**Primary Ability:**
- **Wild Growth** (Active)
- Effect: Heals all party members over 12 seconds
- Trigger: Auto-cast when multiple allies injured
- Cooldown: 45 seconds

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 10. Lightbringer ☀️
**Key:** `lightbringer`  
**Category:** Healer  
**Base Stats:** HP: 110 | ATK: 7 | DEF: 9  
**Theme:** Beacon healer with smart healing

**Primary Ability:**
- **Beacon of Light** (Passive)
- Effect: 40% of healing done to tank also heals the lowest HP ally
- Trigger: Always active

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 11. Shaman (Spirit Healer) 🔱
**Key:** `shaman`  
**Category:** Healer  
**Base Stats:** HP: 100 | ATK: 6 | DEF: 7  
**Theme:** Spiritual healer with chain heals

**Primary Ability:**
- **Chain Heal** (Active)
- Effect: Heals primary target and bounces to 3 other injured allies
- Trigger: Auto-cast on low HP ally
- Cooldown: 30 seconds

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 12. Mistweaver 🌫️
**Key:** `mistweaver`  
**Category:** Healer  
**Base Stats:** HP: 98 | ATK: 7 | DEF: 6  
**Theme:** Mobile healer with channeled healing

**Primary Ability:**
- **Soothing Mist** (Passive)
- Effect: Continuously heals lowest HP ally for 1% max HP per second
- Trigger: Always active

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 13. Chronomancer (Chronomender) ⏰
**Key:** `chronomancer`  
**Category:** Healer  
**Base Stats:** HP: 92 | ATK: 5 | DEF: 5  
**Theme:** Time mage with HP rewind

**Primary Ability:**
- **Temporal Rewind** (Active)
- Effect: Restores all allies to their HP 8 seconds ago
- Trigger: When party takes heavy damage
- Cooldown: 150 seconds

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 14. Bard 🎵
**Key:** `bard`  
**Category:** Healer  
**Base Stats:** HP: 107 | ATK: 7 | DEF: 8  
**Theme:** Support healer who buffs allies with musical magic

**Primary Ability:**
- **Battle Hymn** (Active)
- Effect: Buffs all party members with +15% attack and +10% defense (scales with intellect)
- Trigger: Every 45 seconds in combat
- Cooldown: 45 seconds

**Current Skills (Category-Based - Shared with all Healers):**
Same as Cleric (see above)

**Planned Subclass-Specific Skills:** TBD

---

## ⚔️ MELEE DPS CLASSES (8)

### 15. Berserker ⚔️
**Key:** `berserker`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 130 | ATK: 16 | DEF: 5  
**Theme:** Rage-fueled melee with execute damage

**Primary Ability:**
- **Enrage** (Active)
- Effect: +50% attack damage for 12 seconds
- Trigger: When enemy drops below 30% HP
- Cooldown: 90 seconds

**Current Skills (Category-Based - Shared with all DPS):**
1. **Power Strike** (Lv 5) - Increases damage dealt (+5% per point)
2. **Critical Hit** (Lv 7) - Increases crit chance (+3% per point)
3. **Lethal Blow** (Lv 9) - Increases crit damage (+10% per point)
4. **Combat Mastery** (Lv 11) - Increases attack power (+4% per point)
5. **Fury** (Lv 13) - Increases attack speed (+8% per point)
6. **Execution** (Lv 15) - Bonus damage to low HP enemies (+6% per point)
7. **Precision** (Lv 17) - Higher crit chance (+5% per point)
8. **Berserker Rage** (Lv 19) - Massive damage increase (+7% per point)
9. **Bloodlust** (Lv 21) - Lifesteal on damage (+5% per point)
10. **Master Assassin** (Lv 23) - Ultimate DPS skill (+10% per point)

**Planned Subclass-Specific Skills:** TBD

---

### 16. Crusader 🗡️
**Key:** `crusader`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 140 | ATK: 15 | DEF: 6  
**Theme:** Holy warrior with smite damage

**Primary Ability:**
- **Divine Storm** (Active)
- Effect: Deals 200% weapon damage to all enemies
- Trigger: Every 8 attacks
- Cooldown: Proc-based

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 17. Assassin 🗝️
**Key:** `assassin`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 120 | ATK: 18 | DEF: 4  
**Theme:** Stealth striker with critical hits

**Primary Ability:**
- **Backstab** (Passive)
- Effect: 25% chance to deal 300% critical damage
- Trigger: Always active

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 18. Reaper 💀
**Key:** `reaper`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 125 | ATK: 16 | DEF: 5  
**Theme:** Death knight with DoT damage

**Primary Ability:**
- **Soul Harvest** (Passive)
- Effect: Attacks apply Soul Reap DoT (10 damage/second for 10 seconds)
- Trigger: Always active

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 19. Bladedancer 💃
**Key:** `bladedancer`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 122 | ATK: 17 | DEF: 4  
**Theme:** Agile melee with quick strikes

**Primary Ability:**
- **Whirlwind** (Active)
- Effect: Hits all enemies for 150% damage
- Trigger: Every 6 attacks
- Cooldown: Proc-based

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 20. Monk (Chi Fighter) 🥋
**Key:** `monk`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 128 | ATK: 15 | DEF: 5  
**Theme:** Martial artist with combo attacks

**Primary Ability:**
- **Rising Sun Kick** (Active)
- Effect: Builds combo points, big finisher at 5 stacks
- Trigger: Every 5th attack
- Cooldown: Combo-based

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 21. Storm Warrior ⚡
**Key:** `stormwarrior`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 135 | ATK: 14 | DEF: 6  
**Theme:** Lightning-infused warrior

**Primary Ability:**
- **Thunderstrike** (Passive)
- Effect: 20% chance to chain lightning to 2 additional targets
- Trigger: On attack

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 22. Hunter (Beast Stalker) 🏹
**Key:** `hunter`  
**Category:** DPS (Melee)  
**Base Stats:** HP: 125 | ATK: 16 | DEF: 5  
**Theme:** Pet master with ranged attacks

**Primary Ability:**
- **Call Pet** (Active)
- Effect: Summons pet that deals 30% of your attack as additional damage
- Trigger: Auto-summons in combat
- Cooldown: 60 seconds (pet lasts 30s)

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

## 🔮 RANGED DPS CLASSES (9)

### 23. Mage (Elementalist) 🔮
**Key:** `mage`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 115 | ATK: 19 | DEF: 3  
**Theme:** Arcane caster with elemental rotation

**Primary Ability:**
- **Elemental Mastery** (Passive)
- Effect: Rotates elements (Fire/Frost/Arcane), each with unique effects
- Trigger: Changes every 4 attacks

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 24. Warlock 😈
**Key:** `warlock`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 118 | ATK: 18 | DEF: 4  
**Theme:** Demon summoner with shadow magic

**Primary Ability:**
- **Summon Demon** (Active)
- Effect: Summons demon dealing 35% of attack as shadow damage
- Trigger: Auto-summons
- Cooldown: 60 seconds (lasts 25s)

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 25. Ranger (Marksman) 🏹
**Key:** `ranger`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 122 | ATK: 17 | DEF: 5  
**Theme:** Precision archer with aimed shots

**Primary Ability:**
- **Aimed Shot** (Passive)
- Effect: 15% chance to deal 250% critical damage
- Trigger: On attack

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 26. Shadow Priest (Dark Oracle) 🌑
**Key:** `shadowpriest`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 120 | ATK: 16 | DEF: 4  
**Theme:** Shadow caster with mind damage

**Primary Ability:**
- **Shadow Word: Death** (Active)
- Effect: Deals massive damage to targets below 20% HP
- Trigger: Execute range
- Cooldown: 30 seconds

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 27. Mooncaller 🌙
**Key:** `mooncaller`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 117 | ATK: 17 | DEF: 4  
**Theme:** Lunar/solar balance druid

**Primary Ability:**
- **Eclipse** (Active)
- Effect: Alternates Solar (burst) and Lunar (DoT) forms
- Trigger: Form-based rotation

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 28. Stormcaller ⛈️
**Key:** `stormcaller`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 120 | ATK: 18 | DEF: 4  
**Theme:** Lightning mage with chain damage

**Primary Ability:**
- **Chain Lightning** (Passive)
- Effect: 30% chance to hit 3 additional targets with lightning
- Trigger: On attack

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 29. Necromancer 💀
**Key:** `necromancer`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 116 | ATK: 17 | DEF: 4  
**Theme:** Death mage who raises undead minions

**Primary Ability:**
- **Raise Dead** (Active)
- Effect: Summons undead minion dealing 40% of attack as shadow damage
- Trigger: Auto-summons
- Cooldown: 70 seconds (lasts 30s)

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 30. Frostmage (Frost Invoker) ❄️
**Key:** `frostmage`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 114 | ATK: 19 | DEF: 3  
**Theme:** Frost specialist with slowing effects

**Primary Ability:**
- **Frost Mastery** (Passive)
- Effect: Attacks slow enemies and deal bonus frost damage
- Trigger: Always active

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 31. Firemage (Pyroclast) 🔥
**Key:** `firemage`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 113 | ATK: 20 | DEF: 3  
**Theme:** Fire specialist with explosive damage

**Primary Ability:**
- **Fire Mastery** (Passive)
- Effect: Attacks have a chance to ignite enemies with fire DoT
- Trigger: Always active

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

### 32. Dragonsorcerer (Draconic Sorcerer) 🐉
**Key:** `dragonsorcerer`  
**Category:** DPS (Ranged)  
**Base Stats:** HP: 112 | ATK: 20 | DEF: 3  
**Theme:** Dragon magic caster with fire damage

**Primary Ability:**
- **Dragon Breath** (Active)
- Effect: Cone of fire dealing 250% damage to all enemies
- Trigger: Every 10 attacks
- Cooldown: Proc-based

**Current Skills (Category-Based - Shared with all DPS):**
Same as Berserker (see above)

**Planned Subclass-Specific Skills:** TBD

---

## 📊 Skill System Overview

### Current Implementation
- **Skills per Class:** 10 skills
- **Unlock Levels:** 5, 7, 9, 11, 13, 15, 17, 19, 21, 23
- **Skill Points Earned:** At levels 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30
- **Max Points per Skill:** 5
- **Total Possible Points:** 50 (but limited by level - level 30 = 13 points available)

### Current Skill Effect Types
1. `stat_boost` - Increases attack/defense/hp (flat values)
2. `damage_mult` - Increases damage dealt (%)
3. `healing_mult` - Increases healing done (%)
4. `defense_mult` - Reduces damage taken (%)
5. `crit_chance` - Increases critical hit chance (%)
6. `crit_damage` - Increases critical hit damage (%)
7. `cooldown_red` - Reduces ability cooldowns (%)
8. `lifesteal` - Heals for % of damage dealt
9. `speed_boost` - Increases attack/cast speed (%)
10. `resource_gen` - +X resource generation

### Planned Additions for Subclass-Specific Skills
- `ability_enhance` - Modifies class abilities (duration, effectiveness, etc.)
- `passive_effect` - Unique passive effects (reflect damage, execute damage, etc.)
- `skill_potency` - Increases skill effectiveness/potency
- Additional effect types as needed for unique subclass mechanics

---

## 🎯 Next Steps

1. **Design Phase:** Create unique skill trees for each of the 31 subclasses
2. **Skill Potency System:** Implement skill potency calculations
3. **Combat System Overhaul:** Integrate new skills and effects into combat
4. **Balance Testing:** Ensure all classes remain viable with unique skills
5. **Implementation:** Code subclass-specific skill trees in both frontend and backend

---

## 📝 Notes

- Currently, all classes within a category share the same skill templates
- This document will be updated as subclass-specific skills are designed and implemented
- Each subclass should have 10 unique skills that enhance their primary ability and playstyle
- Skills should scale with skill points (1-5 points per skill)
- Consider skill synergies and build diversity when designing

---

**Last Updated:** [Current Date]  
**Status:** Planning Phase - Subclass-Specific Skill Trees
