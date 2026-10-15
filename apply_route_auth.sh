#!/bin/bash
# Mass apply auth to route files

cd /workspace/src/routes

# Function to add auth middleware to file if not present
add_auth_import() {
  local file=$1
  if ! grep -q "requireAuth.*requireOwnership" "$file"; then
    # Add import after existing imports
    sed -i "s|^const router = express.Router();|import { requireAuth, requireOwnership, requireAdmin, requireGuildMembership, requireGuildOfficer } from '../middleware/auth.js';\n\nconst router = express.Router();|" "$file"
  fi
}

# Apply to all route files that need it
for file in purchases.js mail.js auction.js guilds.js professions.js quests.js raids.js dungeon.js parties.js skills.js enchanting.js achievements.js lootTokens.js worldboss.js reports.js webChat.js battlefields.js leaderboards.js; do
  if [ -f "$file" ]; then
    echo "Adding auth import to $file"
    add_auth_import "$file"
  fi
done

echo "Auth imports added"
