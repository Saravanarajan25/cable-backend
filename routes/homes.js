const express = require('express');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/homes/:homeId
router.get('/:homeId', authMiddleware, async (req, res) => {
    const { homeId } = req.params;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    try {
        const { rows: homeRows } = await query('SELECT * FROM homes WHERE home_id = $1', [homeId]);
        const home = homeRows[0];

        if (!home) {
            return res.status(404).json({ error: 'Home not found' });
        }

        // Get current month payment status
        const { rows: paymentRows } = await query(
            'SELECT * FROM payments WHERE home_id = $1 AND month = $2 AND year = $3',
            [homeId, currentMonth, currentYear]
        );
        const payment = paymentRows[0];

        res.json({
            ...home,
            payment_status: payment ? payment.status : 'unpaid',
            paid_date: payment ? payment.paid_date : null,
            collected_amount: payment ? payment.collected_amount : 0
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
        const insertQuery = `
            INSERT INTO homes (home_id, customer_name, phone, set_top_box_id, monthly_amount)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const { rows } = await query(insertQuery, [home_id, customer_name, phone, set_top_box_id, monthly_amount]);
        const home = rows[0];

        // Immediately create a payment record for the current month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        await query(
            'INSERT INTO payments (home_id, month, year, status, collected_amount) VALUES ($1, $2, $3, $4, $5)',
            [home.home_id, currentMonth, currentYear, 'unpaid', 0]
        );

        res.status(201).json(home);
    } catch (err) {
        if (err.code === '23505') { // Unique violation code in Postgres
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
        const updateQuery = `
            UPDATE homes 
            SET customer_name = $1, phone = $2, set_top_box_id = $3, monthly_amount = $4, updated_at = CURRENT_TIMESTAMP
            WHERE home_id = $5
            RETURNING *
        `;

        const { rows, rowCount } = await query(updateQuery, [customer_name, phone, set_top_box_id, monthly_amount, homeId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Home not found' });
        }

        res.json(rows[0]);
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
        await query('DELETE FROM payments WHERE home_id = $1', [homeId]);

        // Then delete home
        const { rowCount } = await query('DELETE FROM homes WHERE home_id = $1', [homeId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Home not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Database error deleting home:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
