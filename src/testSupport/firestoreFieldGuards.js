/**
 * Guards for in-memory Firestore: mirror real Firestore restrictions in tests.
 */

export function isServerTimestampSentinel(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    (value._methodName === 'serverTimestamp' ||
      value.constructor?.name === 'FieldTransform' &&
      String(value).includes('serverTimestamp'))
  );
}

export function assertNoServerTimestampInsideArrays(value, path = 'root') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (isServerTimestampSentinel(item)) {
        throw new Error(
          `FieldValue.serverTimestamp() cannot be used inside of an array (at ${path}[${i}])`
        );
      }
      assertNoServerTimestampInsideArrays(item, `${path}[${i}]`);
    }
    return;
  }
  if (value != null && typeof value === 'object' && typeof value.toMillis !== 'function') {
    if (isServerTimestampSentinel(value)) {
      throw new Error(
        `FieldValue.serverTimestamp() cannot be used inside of an array (at ${path})`
      );
    }
    for (const [key, child] of Object.entries(value)) {
      assertNoServerTimestampInsideArrays(child, `${path}.${key}`);
    }
  }
}
