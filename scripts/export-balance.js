#!/usr/bin/env node
import { writeBalanceJson, getBalanceJsonPath } from '../src/data/balance.js';

const path = writeBalanceJson();
console.log(`Wrote ${path}`);
