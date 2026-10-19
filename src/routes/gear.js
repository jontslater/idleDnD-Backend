import express from 'express';
import { GEAR_SETS } from '../data/gear/sets.js';
import { GEAR_BASES } from '../data/gear/bases.js';
import { LEGENDARIES } from '../data/gear/legendaries.js';
import { PREFIXES, SUFFIXES } from '../data/gear/affixes.js';
import { withBindingMetadata } from '../utils/itemBinding.js';

const router = express.Router();

router.get('/sets', (_req, res) => {
  res.json({ sets: GEAR_SETS });
});

router.get('/catalog', (_req, res) => {
  res.json(
    withBindingMetadata({
      bases: GEAR_BASES,
      sets: GEAR_SETS.map((s) => ({ ...s, defaultBinding: 'bop' })),
      legendaries: LEGENDARIES.map((l) => ({ ...l, defaultBinding: 'bop' })),
      prefixes: PREFIXES,
      suffixes: SUFFIXES
    })
  );
});

export default router;
