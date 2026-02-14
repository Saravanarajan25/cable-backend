const express = require('express');
const Home = require('../models/Home');
const Payment = require('../models/Payment');
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
        const total = await Home.countDocuments();

        // Get paid count for the CURRENT month/year
        const paid = await Payment.countDocuments({
            month: currentMonth,
            year: currentYear,
            status: 'paid'
        });

        const unpaid = total - paid;

        // Get total collected amount for CURRENT month
        const collectedResult = await Payment.aggregate([
            {
                $match: {
                    month: currentMonth,
                    year: currentYear,
                    status: 'paid'
                }
            },
            {
                $lookup: {
                    from: 'homes',
                    localField: 'home_id',
                    foreignField: 'home_id',
                    as: 'home'
                }
            },
            { $unwind: '$home' },
            {
                $group: {
                    _id: null,
                    total_collected: { $sum: '$home.monthly_amount' }
                }
            }
        ]);
        const total_collected = collectedResult.length > 0 ? collectedResult[0].total_collected : 0;


        // Get total PENDING amount for CURRENT month
        const pendingResult = await Payment.aggregate([
            {
                $match: {
                    month: currentMonth,
                    year: currentYear,
                    status: 'unpaid'
                }
            },
            {
                $lookup: {
                    from: 'homes',
                    localField: 'home_id',
                    foreignField: 'home_id',
                    as: 'home'
                }
            },
            {
                $unwind: '$home'
            },
            {
                $group: {
                    _id: null,
                    total_pending: { $sum: '$home.monthly_amount' }
                }
            }
        ]);
        const total_pending = pendingResult.length > 0 ? pendingResult[0].total_pending : 0;

        res.json({
            total,
            paid,
            unpaid,
            total_collected,
            total_pending
        });
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
