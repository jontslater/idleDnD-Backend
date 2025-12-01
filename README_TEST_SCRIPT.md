# Test Flow Script

This script tests the complete game flow: Idle Adventure → Dungeon → Idle → Raid → Idle

## Prerequisites

1. Backend server must be running on `http://localhost:3001` (or set `API_BASE_URL` environment variable)
2. Firebase must be configured (either emulator or production)
3. Node.js with ES modules support

## Usage

```bash
# Make sure backend is running
cd E:\IdleDnD-Backend
npm run dev

# In another terminal, run the test script
node test-flow-script.js
```

## What It Tests

1. **Setup**: Creates a test hero with appropriate level and stats
2. **Phase 1 - Idle Adventure**: Hero joins battlefield for idle combat
3. **Phase 2 - Dungeon Flow**:
   - Joins dungeon queue
   - Starts dungeon instance
   - Simulates combat progress
   - Completes dungeon
4. **Phase 3 - Return to Idle**: Hero returns to battlefield
5. **Phase 4 - Raid Flow**:
   - Joins raid queue
   - Creates test participants
   - Starts raid instance
   - Simulates combat progress
   - Completes raid
6. **Phase 5 - Final Return to Idle**: Hero returns to battlefield

## Configuration

Edit `TEST_CONFIG` in `test-flow-script.js` to customize:
- `userId`: Test user ID
- `streamerUsername`: Streamer channel name
- `dungeonId`: Which dungeon to test
- `raidId`: Which raid to test
- `heroLevel`: Hero level (must meet requirements)
- `itemScore`: Item score (must meet requirements)

## Notes

- The script simulates combat by reducing boss HP over time
- Enemies have low XP for quick completion
- Test heroes are created for additional raid participants
- The script includes colored console output for easy reading
