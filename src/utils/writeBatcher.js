/**
 * Write Batcher Utility
 * 
 * Batches and debounces Firestore writes to reduce quota usage.
 * Accumulates updates in memory and writes them periodically or when threshold is reached.
 */

class WriteBatcher {
  constructor(options = {}) {
    this.batchInterval = options.batchInterval || 10000; // 10 seconds default (increased to reduce writes)
    this.maxBatchSize = options.maxBatchSize || 20; // Max writes per batch (increased)
    this.pendingWrites = new Map(); // Map<docPath, {data, timestamp}>
    this.flushTimer = null;
    this.db = null;
  }

  setDb(db) {
    this.db = db;
  }

  /**
   * Queue a write operation
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @param {object} data - Data to write (will be merged with existing pending writes)
   * @param {boolean} immediate - If true, flush immediately after this write
   */
  async queueWrite(collection, docId, data, immediate = false) {
    const docPath = `${collection}/${docId}`;
    
    // Merge with existing pending write for this document
    const existing = this.pendingWrites.get(docPath);
    if (existing) {
      // Merge data (new data takes precedence)
      existing.data = { ...existing.data, ...data };
      existing.timestamp = Date.now();
    } else {
      this.pendingWrites.set(docPath, {
        collection,
        docId,
        data,
        timestamp: Date.now()
      });
    }

    // If immediate or batch is full, flush now
    if (immediate || this.pendingWrites.size >= this.maxBatchSize) {
      await this.flush();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush after the batch interval
   */
  scheduleFlush() {
    if (this.flushTimer) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null;
      await this.flush();
    }, this.batchInterval);
  }

  /**
   * Flush all pending writes to Firestore
   */
  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingWrites.size === 0 || !this.db) {
      return;
    }

    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();

    // Group writes by collection for batching
    const batches = new Map();
    
    for (const write of writes) {
      if (!batches.has(write.collection)) {
        batches.set(write.collection, []);
      }
      batches.get(write.collection).push(write);
    }

    // Execute batches
    const promises = [];
    for (const [collection, collectionWrites] of batches.entries()) {
      // Firestore batch limit is 500 operations
      const chunks = [];
      for (let i = 0; i < collectionWrites.length; i += 500) {
        chunks.push(collectionWrites.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = this.db.batch();
        for (const write of chunk) {
          const ref = this.db.collection(write.collection).doc(write.docId);
          batch.set(ref, write.data, { merge: true });
        }
        promises.push(batch.commit());
      }
    }

    try {
      await Promise.all(promises);
      console.log(`[WriteBatcher] ✅ Flushed ${writes.length} write(s) in ${batches.size} batch(es)`);
    } catch (error) {
      console.error('[WriteBatcher] ❌ Error flushing writes:', error);
      // Re-queue failed writes (optional - could cause infinite loops if persistent)
      // For now, just log the error
    }
  }

  /**
   * Force immediate flush of all pending writes
   */
  async forceFlush() {
    await this.flush();
  }

  /**
   * Get pending write count
   */
  getPendingCount() {
    return this.pendingWrites.size;
  }
}

// Singleton instance
let batcherInstance = null;

/**
 * Get or create the singleton WriteBatcher instance
 */
function getWriteBatcher(db = null) {
  if (!batcherInstance) {
    batcherInstance = new WriteBatcher({
      batchInterval: parseInt(process.env.WRITE_BATCH_INTERVAL_MS || '10000', 10), // 10 seconds default
      maxBatchSize: parseInt(process.env.WRITE_BATCH_SIZE || '20', 10) // 20 writes per batch
    });
  }
  
  if (db && !batcherInstance.db) {
    batcherInstance.setDb(db);
  }
  
  return batcherInstance;
}

export { WriteBatcher, getWriteBatcher };
