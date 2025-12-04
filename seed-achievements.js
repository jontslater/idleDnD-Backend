import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const ACHIEVEMENTS = [
  // 🎵 MUSIC REFERENCE ACHIEVEMENTS - Combat
  {
    id: "hit-me-baby-one-more-time",
    name: "Hit Me Baby One More Time",
    description: "Taunt enemies 1,000 times",
    category: "combat",
    subcategory: "music",
    icon: "🎤",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Provocateur", badge: "🎤", gold: 1000, tokens: 10 },
    rarity: "rare",
    hidden: false,
    order: 1,
    trackingKey: "taunts_used"
  },
  {
    id: "youre-as-cold-as-ice",
    name: "You're as Cold as Ice",
    description: "Freeze 500 enemies",
    category: "combat",
    subcategory: "music",
    icon: "❄️",
    requirement: { type: "count", count: 500 },
    rewards: { title: "The Frozen Heart", badge: "❄️", gold: 1500, tokens: 15 },
    rarity: "rare",
    hidden: false,
    order: 2,
    trackingKey: "enemies_frozen"
  },
  {
    id: "dont-go-breaking-my-heart",
    name: "Don't Go Breaking My Heart",
    description: "Weaken 1,000 enemies",
    category: "combat",
    subcategory: "music",
    icon: "💔",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Weakener", badge: "💔", gold: 1200, tokens: 12 },
    rarity: "rare",
    hidden: false,
    order: 3,
    trackingKey: "enemies_weakened"
  },
  {
    id: "another-one-bites-the-dust",
    name: "Another One Bites the Dust",
    description: "Defeat 10,000 enemies",
    category: "combat",
    subcategory: "music",
    icon: "💀",
    requirement: { type: "count", count: 10000 },
    rewards: { title: "The Relentless", badge: "💀", gold: 5000, tokens: 50 },
    rarity: "epic",
    hidden: false,
    order: 4,
    trackingKey: "enemies_defeated"
  },
  {
    id: "stayin-alive",
    name: "Stayin' Alive",
    description: "Survive 100 battles under 10% HP",
    category: "combat",
    subcategory: "music",
    icon: "🕺",
    requirement: { type: "count", count: 100 },
    rewards: { title: "The Survivor", badge: "🕺", gold: 2000, tokens: 20 },
    rarity: "rare",
    hidden: false,
    order: 5,
    trackingKey: "low_hp_survivals"
  },
  {
    id: "eye-of-the-tiger",
    name: "Eye of the Tiger",
    description: "Win 500 consecutive battles without dying",
    category: "combat",
    subcategory: "music",
    icon: "🐅",
    requirement: { type: "count", count: 500 },
    rewards: { title: "The Champion", badge: "🐅", gold: 3000, tokens: 30 },
    rarity: "epic",
    hidden: false,
    order: 6,
    trackingKey: "consecutive_wins"
  },
  {
    id: "bleeding-love",
    name: "Bleeding Love",
    description: "Apply bleed to 1,000 enemies",
    category: "combat",
    subcategory: "music",
    icon: "🩸",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Wounded Warrior", badge: "🩸", gold: 1000, tokens: 10 },
    rarity: "uncommon",
    hidden: false,
    order: 7,
    trackingKey: "bleeds_applied"
  },
  {
    id: "toxic",
    name: "Toxic",
    description: "Apply poison to 5,000 enemies",
    category: "combat",
    subcategory: "music",
    icon: "☠️",
    requirement: { type: "count", count: 5000 },
    rewards: { title: "The Poisoner", badge: "☠️", gold: 2000, tokens: 20 },
    rarity: "rare",
    hidden: false,
    order: 8,
    trackingKey: "poisons_applied"
  },
  {
    id: "burn-baby-burn",
    name: "Burn Baby Burn (Disco Inferno)",
    description: "Burn 3,000 enemies with fire damage",
    category: "combat",
    subcategory: "music",
    icon: "🔥",
    requirement: { type: "count", count: 3000 },
    rewards: { title: "The Pyromaniac", badge: "🔥", gold: 2500, tokens: 25 },
    rarity: "rare",
    hidden: false,
    order: 9,
    trackingKey: "enemies_burned"
  },
  {
    id: "livin-on-a-prayer",
    name: "Livin' on a Prayer",
    description: "Heal allies 10,000 times",
    category: "combat",
    subcategory: "music",
    icon: "🙏",
    requirement: { type: "count", count: 10000 },
    rewards: { title: "The Faithful", badge: "🙏", gold: 3000, tokens: 30 },
    rarity: "epic",
    hidden: false,
    order: 10,
    trackingKey: "heals_cast"
  },

  // 🎬 MOVIE & TV REFERENCES
  {
    id: "you-shall-not-pass",
    name: "You Shall Not Pass!",
    description: "Block 5,000 attacks with shield",
    category: "combat",
    subcategory: "movies",
    icon: "🧙‍♂️",
    requirement: { type: "count", count: 5000 },
    rewards: { title: "The Guardian", badge: "🧙‍♂️", gold: 2500, tokens: 25 },
    rarity: "epic",
    hidden: false,
    order: 11,
    trackingKey: "attacks_blocked"
  },
  {
    id: "may-the-force-be-with-you",
    name: "May the Force Be With You",
    description: "Complete 100 battles without taking damage",
    category: "combat",
    subcategory: "movies",
    icon: "⭐",
    requirement: { type: "count", count: 100 },
    rewards: { title: "The Jedi", badge: "⭐", gold: 5000, tokens: 50 },
    rarity: "legendary",
    hidden: false,
    order: 12,
    trackingKey: "no_damage_battles"
  },
  {
    id: "i-am-inevitable",
    name: "I Am Inevitable",
    description: "Collect all 6 legendary items",
    category: "progression",
    subcategory: "movies",
    icon: "💎",
    requirement: { type: "count", count: 6 },
    rewards: { title: "The Titan", badge: "💎", gold: 10000, tokens: 100 },
    rarity: "legendary",
    hidden: false,
    order: 13,
    trackingKey: "legendary_items_equipped"
  },
  {
    id: "its-over-9000",
    name: "It's Over 9000!",
    description: "Deal over 9,000 damage in a single hit",
    category: "combat",
    subcategory: "movies",
    icon: "💥",
    requirement: { type: "single", count: 9001 },
    rewards: { title: "The Super Saiyan", badge: "💥", gold: 4000, tokens: 40 },
    rarity: "epic",
    hidden: false,
    order: 14,
    trackingKey: "highest_damage_hit"
  },
  {
    id: "clever-girl",
    name: "Clever Girl...",
    description: "Defeat 100 dragon enemies",
    category: "combat",
    subcategory: "movies",
    icon: "🦖",
    requirement: { type: "count", count: 100 },
    rewards: { title: "The Raptor Hunter", badge: "🦖", gold: 5000, tokens: 50 },
    rarity: "epic",
    hidden: false,
    order: 15,
    trackingKey: "dragons_defeated"
  },

  // 🎮 GAMING CULTURE
  {
    id: "git-gud",
    name: "Git Gud",
    description: "Complete hardest difficulty raid",
    category: "combat",
    subcategory: "gaming",
    icon: "🎯",
    requirement: { type: "count", count: 1 },
    rewards: { title: "The Tryhard", badge: "🎯", gold: 5000, tokens: 50 },
    rarity: "legendary",
    hidden: false,
    order: 16,
    trackingKey: "epic_raids_completed"
  },
  {
    id: "press-f",
    name: "Press F to Pay Respects",
    description: "Attend 100 funeral events for fallen heroes",
    category: "social",
    subcategory: "gaming",
    icon: "F",
    requirement: { type: "count", count: 100 },
    rewards: { title: "The Mourner", badge: "F", gold: 1000, tokens: 10 },
    rarity: "uncommon",
    hidden: false,
    order: 17,
    trackingKey: "funerals_attended"
  },
  {
    id: "leeroy-jenkins",
    name: "Leeeroy Jenkins!",
    description: "Rush into battle before party is ready 100 times",
    category: "social",
    subcategory: "gaming",
    icon: "🐔",
    requirement: { type: "count", count: 100 },
    rewards: { title: "The Rash", badge: "🐔", gold: 1000, tokens: 10 },
    rarity: "uncommon",
    hidden: false,
    order: 18,
    trackingKey: "premature_attacks"
  },
  {
    id: "praise-the-sun",
    name: "Praise the Sun!",
    description: "Praise emote 1,000 times",
    category: "social",
    subcategory: "gaming",
    icon: "☀️",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Jolly", badge: "☀️", gold: 1500, tokens: 15 },
    rarity: "rare",
    hidden: false,
    order: 19,
    trackingKey: "praise_emotes"
  },

  // 💼 CLASS-SPECIFIC ACHIEVEMENTS
  {
    id: "the-immovable-object",
    name: "The Immovable Object",
    description: "Take 10,000,000 damage without dying",
    category: "class",
    subcategory: "tank",
    icon: "🛡️",
    requirement: { type: "count", count: 10000000 },
    rewards: { title: "The Unyielding", badge: "🛡️", gold: 5000, tokens: 50 },
    rarity: "legendary",
    hidden: false,
    order: 20,
    trackingKey: "damage_taken_total"
  },
  {
    id: "bodyguard-duty",
    name: "Bodyguard Duty",
    description: "Prevent 5,000 ally deaths",
    category: "class",
    subcategory: "tank",
    icon: "👮",
    requirement: { type: "count", count: 5000 },
    rewards: { title: "The Protector", badge: "👮", gold: 3000, tokens: 30 },
    rarity: "epic",
    hidden: false,
    order: 21,
    trackingKey: "ally_deaths_prevented"
  },
  {
    id: "dr-feel-good",
    name: "Dr. Feel Good",
    description: "Heal 10,000,000 HP total",
    category: "class",
    subcategory: "healer",
    icon: "🩺",
    requirement: { type: "count", count: 10000000 },
    rewards: { title: "The Physician", badge: "🩺", gold: 5000, tokens: 50 },
    rarity: "legendary",
    hidden: false,
    order: 22,
    trackingKey: "healing_done_total"
  },
  {
    id: "glass-cannon",
    name: "Glass Cannon",
    description: "Deal 100,000 damage in one battle while under 10% HP",
    category: "class",
    subcategory: "dps",
    icon: "🔫",
    requirement: { type: "single", count: 100000 },
    rewards: { title: "The Fragile Fury", badge: "🔫", gold: 3000, tokens: 30 },
    rarity: "epic",
    hidden: false,
    order: 23,
    trackingKey: "low_hp_damage_dealt"
  },
  {
    id: "top-dps",
    name: "Top DPS",
    description: "Be top damage dealer in 1,000 battles",
    category: "class",
    subcategory: "dps",
    icon: "👑",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Carry", badge: "👑", gold: 5000, tokens: 50 },
    rarity: "legendary",
    hidden: false,
    order: 24,
    trackingKey: "top_dps_battles"
  },

  // 🏅 PROGRESSION ACHIEVEMENTS
  {
    id: "first-blood",
    name: "First Blood",
    description: "Defeat your first enemy",
    category: "progression",
    subcategory: "leveling",
    icon: "🩸",
    requirement: { type: "count", count: 1 },
    rewards: { title: "The Initiate", badge: "🩸", gold: 100, tokens: 1 },
    rarity: "common",
    hidden: false,
    order: 25,
    trackingKey: "enemies_defeated"
  },
  {
    id: "max-level-achieved",
    name: "Max Level Achieved",
    description: "Reach max level",
    category: "progression",
    subcategory: "leveling",
    icon: "💯",
    requirement: { type: "single", count: 100 },
    rewards: { title: "The Maxed", badge: "💯", gold: 10000, tokens: 100 },
    rarity: "legendary",
    hidden: false,
    order: 26,
    trackingKey: "level"
  },
  {
    id: "millionaire",
    name: "Millionaire",
    description: "Accumulate 1,000,000 gold",
    category: "progression",
    subcategory: "wealth",
    icon: "💰",
    requirement: { type: "single", count: 1000000 },
    rewards: { title: "The Rich", badge: "💰", gold: 0, tokens: 50 },
    rarity: "epic",
    hidden: false,
    order: 27,
    trackingKey: "gold_total"
  },
  {
    id: "token-tycoon",
    name: "Token Tycoon",
    description: "Accumulate 10,000 tokens",
    category: "progression",
    subcategory: "wealth",
    icon: "🐋",
    requirement: { type: "single", count: 10000 },
    rewards: { title: "The Whale", badge: "🐋", gold: 10000, tokens: 0 },
    rarity: "legendary",
    hidden: false,
    order: 28,
    trackingKey: "tokens_total"
  },

  // 🎯 SECRET ACHIEVEMENTS
  {
    id: "the-secret-cow-level",
    name: "The Secret Cow Level",
    description: "Find the hidden cow level",
    category: "secret",
    subcategory: "easter-eggs",
    icon: "🐄",
    requirement: { type: "count", count: 1 },
    rewards: { title: "The Bovine", badge: "🐄", gold: 10000, tokens: 100 },
    rarity: "legendary",
    hidden: true,
    order: 29,
    trackingKey: "secret_cow_found"
  },
  {
    id: "easter-egg-hunter",
    name: "Easter Egg Hunter",
    description: "Find all 50 hidden easter eggs",
    category: "secret",
    subcategory: "easter-eggs",
    icon: "🥚",
    requirement: { type: "count", count: 50 },
    rewards: { title: "The Detective", badge: "🥚", gold: 15000, tokens: 150 },
    rarity: "legendary",
    hidden: false,
    order: 30,
    trackingKey: "easter_eggs_found"
  },

  // 👑 SOCIAL & COMMUNITY
  {
    id: "party-animal",
    name: "Party Animal",
    description: "Join 1,000 different parties",
    category: "social",
    subcategory: "community",
    icon: "🎉",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Social", badge: "🎉", gold: 3000, tokens: 30 },
    rarity: "epic",
    hidden: false,
    order: 31,
    trackingKey: "parties_joined"
  },
  {
    id: "forever-alone",
    name: "Forever Alone",
    description: "Complete 1,000 group quests solo",
    category: "social",
    subcategory: "community",
    icon: "😢",
    requirement: { type: "count", count: 1000 },
    rewards: { title: "The Solo", badge: "😢", gold: 5000, tokens: 50 },
    rarity: "epic",
    hidden: false,
    order: 32,
    trackingKey: "solo_group_quests"
  }
];

async function seedAchievements() {
  console.log('🏆 Starting achievement seed...');
  
  const batch = db.batch();
  
  for (const achievement of ACHIEVEMENTS) {
    const docRef = db.collection('achievements').doc(achievement.id);
    batch.set(docRef, achievement, { merge: true });
  }
  
  await batch.commit();
  
  console.log(`✅ Successfully seeded ${ACHIEVEMENTS.length} achievements!`);
  console.log('\nAchievement Categories:');
  const categories = {};
  ACHIEVEMENTS.forEach(a => {
    categories[a.category] = (categories[a.category] || 0) + 1;
  });
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} achievements`);
  });
  
  process.exit(0);
}

seedAchievements().catch((error) => {
  console.error('❌ Error seeding achievements:', error);
  process.exit(1);
});

