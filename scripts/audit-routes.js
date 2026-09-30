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

// Public routes whitelist (genuinely read-only, no private data)
const PUBLIC_ROUTES = new Set([
  // Auth endpoints
  'POST /api/auth/twitch',
  'POST /api/auth/tiktok',
  'POST /api/auth/logout',
  
  // Public browsing (read-only, no private data)
  'GET /api/leaderboards/:type/:category',
  'GET /api/guilds/',
  'GET /api/guilds/:guildId',
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
  'GET /api/raids/upcoming',
  'GET /api/raids/instance/:instanceId',
  'GET /api/raids/instance/:instanceId/status',
  'GET /api/raids/queue/:raidId',
  'GET /api/raids/:raidId/guild-signup/:guildId',
  'GET /api/dungeon/instance/:instanceId',
  'GET /api/worldboss/active',
  'GET /api/worldboss/:bossId',
  'GET /api/worldboss/:bossId/leaderboard',
  'GET /api/skills/',
  'GET /api/skills/class/:className',
  
  // Stripe webhooks (verified separately by Stripe signature)
  'POST /api/purchases/complete',
  'POST /api/purchases/complete-token-pack',
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
      if (line.includes('requireInternal')) middlewares.push('requireInternal');
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
  let unprotected = 0;
  
  const violations = [];
  
  // Analyze each route
  for (const route of allRoutes) {
    const fullRoute = `${route.method} /api/${route.file.replace('.js', '')}${route.route}`;
    const isPublic = PUBLIC_ROUTES.has(fullRoute);
    const hasAuth = route.middlewares.length > 0;
    
    if (isPublic) {
      publicRoutes++;
    } else if (hasAuth) {
      protectedRoutes++;
    } else {
      // Unprotected and not in PUBLIC whitelist = violation
      unprotected++;
      violations.push({
        ...route,
        reason: 'No auth middleware and not in PUBLIC whitelist',
        fullRoute
      });
    }
  }
  
  // Generate markdown report
  let report = '# Route Protection Audit Report\n\n';
  report += `**Generated**: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  report += `- **Total Routes**: ${totalRoutes}\n`;
  report += `- **Protected**: ${protectedRoutes}\n`;
  report += `- **Public (whitelisted)**: ${publicRoutes}\n`;
  report += `- **Unprotected**: ${unprotected} ${unprotected > 0 ? '❌' : '✅'}\n\n`;
  
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
      
      let display = middleware;
      if (isPublic) display = '✅ PUBLIC';
      
      report += `| ${route.method} | ${route.route} | ${display} | ${route.line} |\n`;
    }
    
    report += '\n';
  }
  
  return { report, violations, stats: { totalRoutes, protectedRoutes, publicRoutes, unprotected } };
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
  console.log(`Unprotected: ${stats.unprotected} ${stats.unprotected > 0 ? '❌' : '✅'}`);
console.log('='.repeat(60));

if (violations.length > 0) {
  console.error(`\n❌ AUDIT FAILED: ${violations.length} violations found`);
  console.error('See ROUTE_PROTECTION_AUDIT.md for details\n');
  process.exit(1);
} else {
  console.log('\n✅ AUDIT PASSED: All routes properly protected\n');
  process.exit(0);
}
