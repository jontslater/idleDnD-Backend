/**
 * Guards for in-memory Firestore: mirror real Firestore restrictions in tests.
 */

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

export function isServerTimestampSentinel(value) {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (value instanceof admin.firestore.FieldValue) {
    return value.constructor?.name === 'ServerTimestampTransform';
  }
  if (value.constructor?.name === 'ServerTimestampTransform') {
    return true;
  }
  return value._methodName === 'serverTimestamp';
}

function walkValue(value, path, insideArray) {
  if (isServerTimestampSentinel(value) && insideArray) {
    throw new Error(
      `FieldValue.serverTimestamp() cannot be used inside of an array (at ${path})`
    );
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkValue(value[i], `${path}[${i}]`, true);
    }
    return;
  }
  if (
    value != null &&
    typeof value === 'object' &&
    typeof value.toMillis !== 'function' &&
    !isServerTimestampSentinel(value)
  ) {
    for (const [key, child] of Object.entries(value)) {
      walkValue(child, `${path}.${key}`, insideArray);
    }
  }
}

export function assertNoServerTimestampInsideArrays(value, path = 'root') {
  walkValue(value, path, false);
}
