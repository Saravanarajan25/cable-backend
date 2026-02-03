const express = require('express');
const { db } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats?month=X&year=Y
router.get('/stats', authMiddleware, (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    // Get total homes count
    db.get('SELECT COUNT(*) as total FROM homes', [], (err, totalResult) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const total = totalResult.total;

        // Get paid count for the month/year
        db.get(
            'SELECT COUNT(*) as paid FROM payments WHERE month = ? AND year = ? AND status = ?',
            [month, year, 'paid'],
            (err, paidResult) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                const paid = paidResult.paid;
                const unpaid = total - paid;

                // Get total collected amount
                db.get(
                    'SELECT SUM(collected_amount) as total_collected FROM payments WHERE month = ? AND year = ?',
                    [month, year],
                    (err, collectedResult) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        res.json({
                            total,
                            paid,
                            unpaid,
                            total_collected: collectedResult.total_collected || 0
                        });
                    }
                );
            }
        );
    });
});

module.exports = router;
