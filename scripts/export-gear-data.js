#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GEAR_BASES } from '../src/data/gear/bases.js';
import { GEAR_SETS, SET_HOOK_CATALOG } from '../src/data/gear/sets.js';
import { LEGENDARIES } from '../src/data/gear/legendaries.js';
import { PREFIXES, SUFFIXES } from '../src/data/gear/affixes.js';
import { BINDING_RULES, ITEM_BINDINGS } from '../src/utils/itemBinding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../data');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'gear-bases.json'), `${JSON.stringify(GEAR_BASES, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, 'gear-sets.json'),
  `${JSON.stringify(GEAR_SETS.map((s) => ({ ...s, defaultBinding: 'bop' })), null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'gear-legendaries.json'),
  `${JSON.stringify(LEGENDARIES.map((l) => ({ ...l, defaultBinding: 'bop' })), null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'gear-binding.json'),
  `${JSON.stringify({ bindings: ITEM_BINDINGS, rules: BINDING_RULES }, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'gear-set-hooks.json'),
  `${JSON.stringify({ hooks: SET_HOOK_CATALOG }, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'gear-set-bonuses.json'),
  `${JSON.stringify(
    GEAR_SETS.map((s) => ({
      id: s.id,
      name: s.name,
      roleGroup: s.roleGroup,
      kind: s.kind,
      tier: s.tier,
      ilvlBand: s.ilvlBand,
      slots: s.slots,
      bonuses: s.bonuses,
      defaultBinding: 'bop'
    })),
    null,
    2
  )}\n`
);
fs.writeFileSync(
  path.join(outDir, 'gear-affixes.json'),
  `${JSON.stringify({ prefixes: PREFIXES, suffixes: SUFFIXES }, null, 2)}\n`
);

console.log('Exported gear data to data/gear-*.json');
