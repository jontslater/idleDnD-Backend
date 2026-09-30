#!/usr/bin/env node
/**
 * Route Protection Audit Script
 * Parses all route files and reports actual middleware protection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTES_DIR = path.join(__dirname, '../src/routes');

// Public routes whitelist (intentionally unprotected)
const PUBLIC_ROUTES = new Set([
  // Auth endpoints
  'POST /api/auth/twitch',
  'POST /api/auth/tiktok',
  'POST /api/auth/logout',
  
  // Public browsing
  'GET /api/leaderboards/user/:userId',
  'GET /api/leaderboards/:type/:category',
  'GET /api/guilds/',
  'GET /api/guilds/:guildId',
  'GET /api/guilds/member/:userId',
  'GET /api/guilds/invite/:inviteId',
  'GET /api/heroes/',
  'GET /api/heroes/create/cost-info',
  'GET /api/heroes/twitch/:twitchUserId',
  'GET /api/auction/listings',
  'GET /api/raids/',
  'GET /api/raids/:raidId',
  'GET /api/raids/:raidId/participants',
  'GET /api/dungeon/',
  'GET /api/dungeon/:dungeonId',
  'GET /api/parties/search',
  'GET /api/quests/daily',
  'GET /api/quests/weekly',
  'GET /api/quests/monthly',
  'GET /api/achievements/',
  'GET /api/guildPerks/hero/:userId',
  'GET /api/guildPerks/calculate/:level',
  'GET /api/enchanting/enchantments/:slot',
  'GET /api/enchanting/enchantments',
  'GET /api/skills/tree/templates',
  'GET /api/worldboss/status',
  'GET /api/worldboss/leaderboard',
  'GET /api/battlefields/:battlefieldId/heroes',
  'GET /api/battlefields/active',
  'GET /api/battlefields/:battlefieldId/state',
  'GET /api/battlefields/:battlefieldId/combat/xp/status',
  'GET /api/purchases/success',
  'GET /api/purchases/cancel',
  'GET /api/purchases/founders',
  
  // Stripe webhooks (verified separately)
  'POST /api/purchases/complete',
  'POST /api/purchases/complete-token-pack',
]);

// Internal service routes (called by backend, not HTTP clients)
const INTERNAL_ROUTES = new Set([
  'POST /api/battlefields/register',
  'POST /api/battlefields/:battlefieldId/combat/xp/accumulate',
  'POST /api/battlefields/:battlefieldId/combat/xp/flush',
  'POST /api/leaderboards/update',
  'POST /api/lootTokens/award',
  'POST /api/achievements/check',
  'POST /api/quests/update-batch-all',
  'POST /api/chat/join', // Called by Twitch bot internally
  'POST /api/streamSettings/:twitchId/test', // Called internally
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseRouteFile(filename) {
  const filePath = path.join(ROUTES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const routes = [];
  const routePattern = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(routePattern);
    
    if (match) {
      const method = match[1].toUpperCase();
      const route = match[2];
      
      // Extract middleware from the line
      const middlewares = [];
      if (line.includes('requireAuth')) middlewares.push('requireAuth');
      if (line.includes('requireOwnership')) middlewares.push('requireOwnership');
      if (line.includes('requireAdmin')) middlewares.push('requireAdmin');
      if (line.includes('requireStreamerAccess')) middlewares.push('requireStreamerAccess');
      if (line.includes('requireGuildMembership')) middlewares.push('requireGuildMembership');
      if (line.includes('requireGuildOfficer')) middlewares.push('requireGuildOfficer');
      if (line.includes('optionalAuth')) middlewares.push('optionalAuth');
      if (line.includes('verifyToken')) middlewares.push('verifyToken');
      if (line.includes('verifyTwitchToken')) middlewares.push('verifyTwitchToken');
      
      routes.push({
        file: filename,
        method,
        route,
        middlewares,
        line: i + 1,
        code: line.trim()
      });
    }
  }
  
  return routes;
}

function generateReport() {
  const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
  
  let allRoutes = [];
  for (const file of files) {
    const routes = parseRouteFile(file);
    allRoutes = allRoutes.concat(routes);
  }
  
  // Statistics
  let totalRoutes = allRoutes.length;
  let protectedRoutes = 0;
  let publicRoutes = 0;
  let internalRoutes = 0;
  let unprotectedMutating = 0;
  let unprotectedPrivateData = 0;
  
  const violations = [];
  
  // Analyze each route
  for (const route of allRoutes) {
    const fullRoute = `${route.method} /api/${route.file.replace('.js', '')}${route.route}`;
    const isPublic = PUBLIC_ROUTES.has(fullRoute);
    const isInternal = INTERNAL_ROUTES.has(fullRoute);
    const isMutating = MUTATING_METHODS.has(route.method);
    const hasAuth = route.middlewares.length > 0;
    const isPrivateData = route.route.includes(':userId') || route.route.includes(':heroId') || 
                          route.route.includes('my-') || route.route.includes('/history/') ||
                          route.route.includes('/progress') || route.route.includes('/balance') ||
                          route.route.includes('/inventory');
    
    if (isPublic) {
      publicRoutes++;
    } else if (isInternal) {
      internalRoutes++;
    } else if (hasAuth) {
      protectedRoutes++;
    } else {
      // Unprotected route - is this a violation?
      if (isMutating && !isPublic && !isInternal) {
        unprotectedMutating++;
        violations.push({
          ...route,
          reason: 'Mutating route without auth',
          fullRoute
        });
      }
      if (isPrivateData && !isPublic && !isInternal) {
        unprotectedPrivateData++;
        violations.push({
          ...route,
          reason: 'Private data route without auth',
          fullRoute
        });
      }
    }
  }
  
  // Generate markdown report
  let report = '# Route Protection Audit Report\n\n';
  report += `**Generated**: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  report += `- **Total Routes**: ${totalRoutes}\n`;
  report += `- **Protected**: ${protectedRoutes}\n`;
  report += `- **Public (whitelisted)**: ${publicRoutes}\n`;
  report += `- **Internal (backend services)**: ${internalRoutes}\n`;
  report += `- **Unprotected Mutating**: ${unprotectedMutating} ❌\n`;
  report += `- **Unprotected Private Data**: ${unprotectedPrivateData} ❌\n\n`;
  
  if (violations.length > 0) {
    report += '## ❌ VIOLATIONS\n\n';
    report += '| File | Method | Route | Reason | Line |\n';
    report += '|------|--------|-------|--------|------|\n';
    for (const v of violations) {
      report += `| ${v.file} | ${v.method} | ${v.route} | ${v.reason} | ${v.line} |\n`;
    }
    report += '\n';
  } else {
    report += '## ✅ NO VIOLATIONS\n\nAll routes are properly protected!\n\n';
  }
  
  // Detailed table by file
  report += '## Detailed Route Protection by File\n\n';
  
  const fileGroups = {};
  for (const route of allRoutes) {
    if (!fileGroups[route.file]) fileGroups[route.file] = [];
    fileGroups[route.file].push(route);
  }
  
  for (const [file, routes] of Object.entries(fileGroups).sort()) {
    const basename = file.replace('.js', '');
    report += `### ${file} (${routes.length} routes)\n\n`;
    report += '| Method | Route | Middleware | Line |\n';
    report += '|--------|-------|------------|------|\n';
    
    for (const route of routes) {
      const middleware = route.middlewares.length > 0 ? route.middlewares.join(', ') : '❌ **NONE**';
      const fullRoute = `${route.method} /api/${basename}${route.route}`;
      const isPublic = PUBLIC_ROUTES.has(fullRoute);
      const isInternal = INTERNAL_ROUTES.has(fullRoute);
      
      let display = middleware;
      if (isPublic) display = '✅ PUBLIC';
      if (isInternal) display = '🔧 INTERNAL';
      
      report += `| ${route.method} | ${route.route} | ${display} | ${route.line} |\n`;
    }
    
    report += '\n';
  }
  
  return { report, violations, stats: { totalRoutes, protectedRoutes, publicRoutes, internalRoutes, unprotectedMutating, unprotectedPrivateData } };
}

// Run audit
const { report, violations, stats } = generateReport();

// Write report
const reportPath = path.join(__dirname, '../ROUTE_PROTECTION_AUDIT.md');
fs.writeFileSync(reportPath, report);

console.log('Route Protection Audit');
console.log('='.repeat(60));
console.log(`Total Routes: ${stats.totalRoutes}`);
console.log(`Protected: ${stats.protectedRoutes}`);
console.log(`Public (whitelisted): ${stats.publicRoutes}`);
console.log(`Internal: ${stats.internalRoutes}`);
console.log(`Unprotected Mutating: ${stats.unprotectedMutating} ${stats.unprotectedMutating > 0 ? '❌' : '✅'}`);
console.log(`Unprotected Private Data: ${stats.unprotectedPrivateData} ${stats.unprotectedPrivateData > 0 ? '❌' : '✅'}`);
console.log('='.repeat(60));

if (violations.length > 0) {
  console.error(`\n❌ AUDIT FAILED: ${violations.length} violations found`);
  console.error('See ROUTE_PROTECTION_AUDIT.md for details\n');
  process.exit(1);
} else {
  console.log('\n✅ AUDIT PASSED: All routes properly protected\n');
  process.exit(0);
}
