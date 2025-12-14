import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

/**
 * Submit a bug report or issue
 * POST /api/reports
 * Body: {
 *   userId: string,
 *   username: string,
 *   title: string,
 *   description: string,
 *   category: string (optional),
 *   severity: string (optional),
 *   stepsToReproduce: string (optional),
 *   expectedBehavior: string (optional),
 *   actualBehavior: string (optional)
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      username,
      title,
      description,
      category,
      severity,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior
    } = req.body;

    // Validate required fields
    if (!userId || !username || !title || !description) {
      return res.status(400).json({
        error: 'userId, username, title, and description are required'
      });
    }

    // Create report document
    const reportData = {
      userId: String(userId),
      username: String(username),
      title: title.trim(),
      description: description.trim(),
      category: category || 'general',
      severity: severity || 'medium',
      stepsToReproduce: stepsToReproduce?.trim() || '',
      expectedBehavior: expectedBehavior?.trim() || '',
      actualBehavior: actualBehavior?.trim() || '',
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const reportRef = await db.collection('reports').add(reportData);

    console.log(`[Reports] New report submitted: ${reportRef.id} by ${username}`);

    res.status(201).json({
      success: true,
      reportId: reportRef.id,
      message: 'Report submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({
      error: error.message || 'Failed to submit report'
    });
  }
});

/**
 * Get all reports (for admin viewing) or user's own reports
 * GET /api/reports
 * Query params:
 *   - userId: filter by userId (for non-admin users to see their own reports)
 *   - status: filter by status (open, in-progress, resolved, closed)
 *   - limit: number of reports to return (default: 50)
 *   - orderBy: field to order by (default: createdAt)
 *   - order: asc or desc (default: desc)
 */
router.get('/', async (req, res) => {
  try {
    const {
      userId,
      status,
      limit = 50,
      orderBy = 'createdAt',
      order = 'desc'
    } = req.query;

    let query = db.collection('reports');
    let reports = [];

    // If userId is provided (non-admin), filter by userId first
    // Note: We can't use both userId and status where() clauses without a composite index
    // So if userId is provided, we'll filter status in memory
    if (userId) {
      query = query.where('userId', '==', String(userId));
    } else if (status) {
      // Only filter by status if userId is not provided (admin view)
      query = query.where('status', '==', status);
    }

    // Order by specified field
    query = query.orderBy(orderBy, order);

    // Limit results (apply a higher limit if we need to filter in memory)
    const limitNum = parseInt(limit, 10);
    const queryLimit = userId && status ? 1000 : (limitNum > 100 ? 100 : limitNum); // Fetch more if filtering in memory
    query = query.limit(queryLimit);

    const snapshot = await query.get();

    reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null
    }));

    // Filter by status in memory if userId was provided
    if (userId && status) {
      reports = reports.filter(r => r.status === status);
    }

    // Apply the actual limit after filtering
    if (userId && status) {
      reports = reports.slice(0, limitNum > 100 ? 100 : limitNum);
    }

    res.json({
      success: true,
      reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch reports'
    });
  }
});

/**
 * Get a single report by ID
 * GET /api/reports/:reportId
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    const reportDoc = await db.collection('reports').doc(reportId).get();

    if (!reportDoc.exists) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = {
      id: reportDoc.id,
      ...reportDoc.data(),
      createdAt: reportDoc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: reportDoc.data().updatedAt?.toDate?.()?.toISOString() || null
    };

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch report'
    });
  }
});

/**
 * Update report status (admin only - restricted to theneverendingwar)
 * PATCH /api/reports/:reportId
 * Body: {
 *   status: string (open, in-progress, resolved, closed),
 *   adminNotes: string (optional),
 *   username: string (required - must be 'theneverendingwar')
 * }
 */
router.patch('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNotes, username } = req.body;

    // Only allow theneverendingwar to update report status
    if (username !== 'theneverendingwar') {
      return res.status(403).json({
        error: 'Unauthorized: Only admin can update report status'
      });
    }

    if (!status) {
      return res.status(400).json({
        error: 'status is required'
      });
    }

    const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const reportRef = db.collection('reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes.trim();
    }

    await reportRef.update(updateData);

    console.log(`[Reports] Report ${reportId} updated to status: ${status} by ${username}`);

    res.json({
      success: true,
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({
      error: error.message || 'Failed to update report'
    });
  }
});

export default router;
