#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listCraftRecipes } from '../src/data/craftRecipes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '../data/craftRecipes.json');
fs.writeFileSync(out, `${JSON.stringify(listCraftRecipes(), null, 2)}\n`);
console.log(`Wrote ${out}`);
