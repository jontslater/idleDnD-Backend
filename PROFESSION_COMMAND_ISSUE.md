# Backend Profession Command Issue

**Date:** December 2, 2025  
**Status:** ❌ BROKEN - Needs Fix

---

## 🐛 The Problem

**Command:** `!profession choose enchanting`  
**Response:** "You need to !join first!"  
**Actual Status:** Hero is already joined and active on battlefield

---

## 📊 Symptoms

1. Hero successfully joins battlefield (`!join` works)
2. Hero can be seen on browser source
3. `!profession choose [profession]` command fails
4. Error message claims hero not joined
5. Web app shows profession data exists
6. Browser source doesn't see profession data

---

## 🔍 Additional Issues

1. **Duplicate Heroes on Browser Source**
   - tehchno shows as 2 heroes on browser source
   - Both appear on same battlefield
   - Might be issue with hero switching (!join 2)
   
2. **Profession Data Not Syncing**
   - Web app claims hero has profession
   - Browser source doesn't load profession data
   - Gathering not triggering for these heroes

---

## 🎯 Root Causes (Suspected)

### Issue 1: Session/Hero Detection in Command Handler
**File:** `E:\IdleDnD-Backend\src\routes\professions.js`

The `!profession` command handler likely:
- Checks if hero is joined
- Uses wrong session key or hero ID
- Fails validation even when hero is valid

**Need to check:**
- How hero is retrieved from session
- What validation is failing
- If hero ID is being found correctly

### Issue 2: Duplicate currentBattlefieldId
**File:** `E:\IdleDnD-Backend\src\routes\heroes.js`

When hero switches (!join 2):
- Old hero might not clear currentBattlefieldId
- New hero sets currentBattlefieldId
- Both appear on same battlefield

**Need to check:**
- !leave command clears currentBattlefieldId
- !join command clears previous hero's battlefield
- Hero switching properly manages battlefield assignments

### Issue 3: Profession Data Structure
**Database:** Firebase `heroes` collection

Profession data might be:
- Stored in different format than expected
- Not syncing to all clients
- Browser source loading wrong field

**Need to verify:**
- Exact structure of profession data in Firebase
- What browser source expects vs what's actually stored
- If sync is working correctly

---

## 🛠️ Files to Check

1. **Backend Command Handler:**
   - `E:\IdleDnD-Backend\src\routes\professions.js`
   - Look for hero validation logic
   - Check session management

2. **Hero Management:**
   - `E:\IdleDnD-Backend\src\routes\heroes.js`
   - Check !join command
   - Check !leave command
   - Check hero switching logic

3. **Browser Source Query:**
   - `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx` (line ~170)
   - Verify profession loading
   - Add more debug logging

---

## ✅ Browser Source Code (Already Correct)

The browser source gathering code works correctly:
```typescript
setHeroes(current => {
  const updated = current.map(hero => {
    if (!hero.profession || hero.isDead) return hero;
    // Gathering logic - works for ANY hero with profession!
  });
});
```

**This will work once:**
- Backend commands set profession data correctly
- Duplicate heroes are resolved
- Data syncs properly

---

## 🎯 Action Items

### High Priority
1. Fix `!profession` command validation
2. Fix duplicate hero issue on battlefield
3. Verify profession data structure and sync

### Medium Priority  
4. Add better error messages for debugging
5. Add logging to profession command handler
6. Test hero switching flow thoroughly

### Low Priority
7. Document expected data structures
8. Add data validation
9. Add migration for any corrupted data

---

## 💡 Temporary Workaround

**For testing gathering:**
- Manually set profession in Firebase console
- Or use Electron app to set profession (if commands work there)
- Or fix backend commands before testing

---

## 📝 Notes for Future

This issue highlights need for:
- Better session management
- Clearer hero state tracking
- More robust validation
- Better error messages
- Comprehensive logging

**Backend commands are critical for gameplay - should be prioritized!**




