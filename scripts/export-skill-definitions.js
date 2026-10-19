#!/usr/bin/env node
import { writeSkillDefinitionsJson, getSkillDefinitionsJsonPath } from '../src/data/skillDefinitions.js';

const path = writeSkillDefinitionsJson();
console.log(`Wrote ${path}`);
