const express = require('express');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats?month=X&year=Y
router.get('/stats', async (req, res) => {
    // STRICTLY use current server time for dashboard
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentYear = now.getFullYear();

    try {
        // Get total homes count
        const { rows: totalRows } = await query('SELECT COUNT(*) as total FROM homes');
        const total = parseInt(totalRows[0].total);

        // Get paid count for the CURRENT month/year
        const { rows: paidRows } = await query(
            'SELECT COUNT(*) as paid FROM payments WHERE month = $1 AND year = $2 AND status = $3',
            [currentMonth, currentYear, 'paid']
        );
        const paid = parseInt(paidRows[0].paid);
        const unpaid = total - paid;

        // Get total collected amount for CURRENT month
        const { rows: collectedRows } = await query(
            'SELECT SUM(collected_amount) as total_collected FROM payments WHERE month = $1 AND year = $2 AND status = $3',
            [currentMonth, currentYear, 'paid']
        );

        // Get total PENDING amount for CURRENT month
        const pendingQuery = `
            SELECT SUM(h.monthly_amount) as total_pending 
            FROM payments p 
            JOIN homes h ON p.home_id = h.home_id 
            WHERE p.month = $1 AND p.year = $2 AND p.status = 'unpaid'
        `;

        const { rows: pendingRows } = await query(pendingQuery, [currentMonth, currentYear]);

        res.json({
            total,
            paid,
            unpaid,
            total_collected: collectedRows[0].total_collected || 0,
            total_pending: pendingRows[0].total_pending || 0
        });
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
