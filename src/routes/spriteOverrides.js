import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { verifyToken } from './auth.js';
import { requireSpriteOverrideAdmin, resolveTwitchLoginFromUser } from '../utils/spriteOverrideAdmin.js';
import {
  documentToResponse,
  EMPTY_SPRITE_OVERRIDES,
  validateSpriteOverridesPayload,
} from '../utils/spriteOverridesValidation.js';

const router = express.Router();
const CONFIG_REF = db.collection('config').doc('spriteOverrides');

router.get('/', async (req, res) => {
  try {
    const snap = await CONFIG_REF.get();
    if (!snap.exists) {
      return res.json({ ...EMPTY_SPRITE_OVERRIDES });
    }
    res.json(documentToResponse(snap.data()));
  } catch (error) {
    console.error('[spriteOverrides] GET failed:', error);
    res.status(500).json({ error: 'Failed to load sprite overrides' });
  }
});

router.put('/', verifyToken, requireSpriteOverrideAdmin, async (req, res) => {
  try {
    const parsed = validateSpriteOverridesPayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const updatedBy = resolveTwitchLoginFromUser(req.user);
    const payload = {
      heroes: parsed.heroes,
      enemies: parsed.enemies,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy,
    };

    await CONFIG_REF.set(payload, { merge: false });

    const saved = await CONFIG_REF.get();
    res.json(documentToResponse(saved.data()));
  } catch (error) {
    console.error('[spriteOverrides] PUT failed:', error);
    res.status(500).json({ error: 'Failed to save sprite overrides' });
  }
});

export default router;
