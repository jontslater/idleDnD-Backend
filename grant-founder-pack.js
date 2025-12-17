/**
 * Script to grant founder pack to a user
 * Usage: node grant-founder-pack.js <username> <tier>
 * Example: node grant-founder-pack.js gardeningorgaming platinum
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const username = process.argv[2];
const tier = process.argv[3];

if (!username || !tier) {
  console.error('Usage: node grant-founder-pack.js <username> <tier>');
  console.error('Example: node grant-founder-pack.js gardeningorgaming platinum');
  process.exit(1);
}

if (!['bronze', 'silver', 'gold', 'platinum'].includes(tier.toLowerCase())) {
  console.error('Invalid tier. Must be: bronze, silver, gold, or platinum');
  process.exit(1);
}

async function grantFounderPack() {
  try {
    console.log(`Granting ${tier} founder pack to ${username}...`);
    
    const response = await fetch(`${API_URL}/api/purchases/set-founder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        tier: tier
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success!');
      console.log(`Message: ${data.message}`);
      console.log(`Heroes updated: ${data.heroesUpdated}`);
      if (data.heroes && data.heroes.length > 0) {
        console.log('Heroes:');
        data.heroes.forEach(hero => {
          console.log(`  - ${hero.heroName} (${hero.heroId})`);
        });
      }
    } else {
      console.error('❌ Error:', data.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to grant founder pack:', error.message);
    process.exit(1);
  }
}

grantFounderPack();
