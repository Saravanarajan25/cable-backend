const express = require('express');
const Home = require('../models/Home');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/homes/:homeId
router.get('/:homeId', authMiddleware, async (req, res) => {
    const { homeId } = req.params;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    try {
        const home = await Home.findOne({ home_id: homeId }).lean();

        if (!home) {
            return res.status(404).json({ error: 'Home not found' });
        }

        // Get current month payment status
        const payment = await Payment.findOne({
            home_id: homeId,
            month: currentMonth,
            year: currentYear
        }).lean();

        res.json({
            ...home,
            payment_status: payment ? payment.status : 'unpaid',
            paid_date: payment ? payment.paid_date : null,
            collected_amount: (payment && payment.status === 'paid') ? home.monthly_amount : 0
        });
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/homes
router.post('/', authMiddleware, async (req, res) => {
    const { home_id, customer_name, phone, set_top_box_id, monthly_amount } = req.body;

    if (home_id === undefined || home_id === null || !customer_name || !phone || !set_top_box_id || monthly_amount === undefined || monthly_amount === null) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const home = await Home.create({
            home_id,
            customer_name,
            phone,
            set_top_box_id,
            monthly_amount
        });

        // Immediately create a payment record for the current month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        await Payment.create({
            home_id: home.home_id,
            month: currentMonth,
            year: currentYear,
            status: 'unpaid'
        });

        res.status(201).json(home);
    } catch (err) {
        if (err.code === 11000) { // Duplicate key error in Mongoose
            return res.status(400).json({ error: 'A home with this ID already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/homes/:homeId - Edit Customer
router.put('/:homeId', authMiddleware, async (req, res) => {
    const homeId = req.params.homeId;
    const { customer_name, phone, set_top_box_id, monthly_amount } = req.body;

    if (!customer_name || !phone || !set_top_box_id || monthly_amount === undefined || monthly_amount === null) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const home = await Home.findOneAndUpdate(
            { home_id: homeId },
            {
                customer_name,
                phone,
                set_top_box_id,
                monthly_amount
            },
            { new: true } // Return updated document
        );

        if (!home) {
            return res.status(404).json({ error: 'Home not found' });
        }

        res.json(home);
    } catch (err) {
        console.error('Database error during update:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/homes/:homeId - Delete Customer
router.delete('/:homeId', authMiddleware, async (req, res) => {
    const homeId = req.params.homeId;

    try {
        // First delete related payments
        await Payment.deleteMany({ home_id: homeId });

        // Then delete home
        const result = await Home.deleteOne({ home_id: homeId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Home not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Database error deleting home:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
