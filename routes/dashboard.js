const express = require('express');
const { db } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats?month=X&year=Y
router.get('/stats', (req, res) => {
    // STRICTLY use current server time for dashboard
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentYear = now.getFullYear();

    // Get total homes count
    db.get('SELECT COUNT(*) as total FROM homes', [], (err, totalResult) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const total = totalResult.total;

        // Get paid count for the CURRENT month/year
        db.get(
            'SELECT COUNT(*) as paid FROM payments WHERE month = ? AND year = ? AND status = ?',
            [currentMonth, currentYear, 'paid'],
            (err, paidResult) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                const paid = paidResult.paid;
                const unpaid = total - paid;

                // Get total collected amount for CURRENT month
                db.get(
                    'SELECT SUM(collected_amount) as total_collected FROM payments WHERE month = ? AND year = ? AND status = ?',
                    [currentMonth, currentYear, 'paid'],
                    (err, collectedResult) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        // Get total PENDING amount for CURRENT month
                        // Logic: Sum of daily/monthly amounts for homes that are NOT paid in the current month
                        // But since we track payments by records, we look for 'unpaid' records for this month.
                        // IMPORTANT: The monthly reset script CREATES 'unpaid' records for all homes at start of month.
                        // So we can just sum monthly_amount from homes linked to unpaid payments for this month.

                        const pendingQuery = `
                            SELECT SUM(h.monthly_amount) as total_pending 
                            FROM payments p 
                            JOIN homes h ON p.home_id = h.home_id 
                            WHERE p.month = ? AND p.year = ? AND p.status = 'unpaid'
                        `;

                        db.get(
                            pendingQuery,
                            [currentMonth, currentYear],
                            (err, pendingResult) => {
                                if (err) {
                                    console.error('Database error:', err);
                                    return res.status(500).json({ error: 'Internal server error' });
                                }

                                res.json({
                                    total,
                                    paid,
                                    unpaid,
                                    total_collected: collectedResult.total_collected || 0,
                                    total_pending: pendingResult.total_pending || 0
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

module.exports = router;
