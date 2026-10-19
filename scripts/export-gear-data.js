#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GEAR_BASES } from '../src/data/gear/bases.js';
import { GEAR_SETS } from '../src/data/gear/sets.js';
import { LEGENDARIES } from '../src/data/gear/legendaries.js';
import { PREFIXES, SUFFIXES } from '../src/data/gear/affixes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../data');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'gear-bases.json'), `${JSON.stringify(GEAR_BASES, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'gear-sets.json'), `${JSON.stringify(GEAR_SETS, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'gear-legendaries.json'), `${JSON.stringify(LEGENDARIES, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, 'gear-affixes.json'),
  `${JSON.stringify({ prefixes: PREFIXES, suffixes: SUFFIXES }, null, 2)}\n`
);

console.log('Exported gear data to data/gear-*.json');
