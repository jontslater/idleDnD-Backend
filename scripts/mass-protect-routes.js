#!/usr/bin/env node
/**
 * Mass Route Protection Script
 * Applies auth middleware to all unprotected routes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROUTES_DIR = path.join(__dirname, '../src/routes');

// Route protection rules
const PROTECTION_RULES = {
  // userId/heroId routes need ownership
  '/:userId': 'requireAuth, requireOwnership',
  '/:heroId': 'requireAuth, requireOwnership',
  '/my-': 'requireAuth, requireOwnership',
  
  // Admin routes
  '/admin/': 'requireAdmin',
  '/test/': 'requireAdmin',
  '/set-founder': 'requireAdmin',
  '/remove-founder': 'requireAdmin',
  '/spawn': 'requireAdmin',
  '/reset': 'requireAdmin',
  '/unlock-all': 'requireAdmin',
  
  // Guild routes
  'guilds': {
    'POST /': 'requireAuth',
    'PUT /:guildId': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'POST /:guildId/join': 'requireAuth',
    'POST /:guildId/apply': 'requireAuth',
    'POST /:guildId/approve': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'POST /:guildId/reject': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'PUT /:guildId/settings': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'POST /:guildId/loot/assign': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'GET /:guildId/loot': 'requireAuth, requireGuildMembership',
    'GET /:guildId/loot/history': 'requireAuth, requireGuildMembership',
    'POST /:guildId/leave': 'requireAuth',
    'GET /:guildId/members-with-heroes': 'requireAuth, requireGuildMembership',
    'POST /:guildId/invite': 'requireAuth, requireGuildMembership, requireGuildOfficer',
    'POST /invite/:inviteId/accept': 'requireAuth',
    'GET /invites/pending/:heroId': 'requireAuth, requireOwnership',
    'GET /:guildId/invites': 'requireAuth, requireGuildMembership',
  }
};

function protectRoute(line, method, route, file) {
  // Skip if already has middleware
  if (line.includes('requireAuth') || line.includes('requireAdmin') || 
      line.includes('requireOwnership') || line.includes('verifyToken') ||
      line.includes('requireStreamerAccess') || line.includes('requireGuildMembership')) {
    return line;
  }
  
  // Determine protection needed
  let protection = null;
  
  // Admin routes
  if (route.includes('/admin/') || route.includes('/test/') || 
      route.includes('set-founder') || route.includes('remove-founder') ||
      route.includes('/spawn') || route.includes('/reset') || route.includes('/unlock-all')) {
    protection = 'requireAdmin';
  }
  // User-owned resources
  else if ((route.includes(':userId') || route.includes(':heroId') || route.includes('/my-')) && 
           (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE' || method === 'GET')) {
    if (route.includes('/my-') || route.includes('/history/') || route.includes('/progress')) {
      protection = 'requireAuth, requireOwnership';
    } else {
      protection = 'requireAuth, requireOwnership';
    }
  }
  // Mutating routes
  else if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    protection = 'requireAuth';
  }
  // Private data GET routes
  else if (method === 'GET' && (route.includes('/queue/status') || route.includes('/balance') || 
           route.includes('/inventory') || route.includes('/tokens'))) {
    protection = 'requireAuth';
  }
  
  if (!protection) return line;
  
  // Apply protection
  const routeMatch = line.match(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"],\s*(async)?/);
  if (routeMatch) {
    const hasAsync = routeMatch[3];
    if (hasAsync) {
      return line.replace(
        `router.${routeMatch[1]}('${routeMatch[2]}', async`,
        `router.${routeMatch[1]}('${routeMatch[2]}', ${protection}, async`
      );
    } else {
      return line.replace(
        `router.${routeMatch[1]}('${routeMatch[2]}',`,
        `router.${routeMatch[1]}('${routeMatch[2]}', ${protection},`
      );
    }
  }
  
  return line;
}

function processFile(filename) {
  const filePath = path.join(ROUTES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let modified = false;
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const routeMatch = line.match(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/);
    
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const route = routeMatch[2];
      const newLine = protectRoute(line, method, route, filename);
      
      if (newLine !== line) {
        modified = true;
        console.log(`  ${method} ${route}: Added protection`);
      }
      newLines.push(newLine);
    } else {
      newLines.push(line);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    return true;
  }
  
  return false;
}

// Process all route files
const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));

console.log('Mass Protecting Routes');
console.log('='.repeat(60));

let totalModified = 0;
for (const file of files.sort()) {
  console.log(`\nProcessing ${file}...`);
  const modified = processFile(file);
  if (modified) {
    totalModified++;
    console.log(`  ✓ Modified`);
  } else {
    console.log(`  - No changes needed`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Modified ${totalModified} files`);
console.log('Run npm test to verify protection\n');
