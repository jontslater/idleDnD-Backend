/** Single source of truth for founder pack Stripe pricing (USD). */
export const PACK_TIERS = {
  bronze: { price: 5, premiumCurrency: 25, name: 'Bronze Founder' },
  silver: { price: 10, premiumCurrency: 75, name: 'Silver Founder' },
  gold: { price: 15, premiumCurrency: 150, name: 'Gold Founder' },
  platinum: { price: 25, premiumCurrency: 250, name: 'Platinum Founder' }
};

export const TIER_LEVELS = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4
};
