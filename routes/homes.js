const express = require('express');
const { db } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/homes/:homeId
router.get('/:homeId', authMiddleware, (req, res) => {
    const { homeId } = req.params;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    db.get('SELECT * FROM homes WHERE home_id = ?', [homeId], (err, home) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!home) {
            return res.status(404).json({ error: 'Home not found' });
        }

        // Get current month payment status
        db.get(
            'SELECT * FROM payments WHERE home_id = ? AND month = ? AND year = ?',
            [homeId, currentMonth, currentYear],
            (err, payment) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                res.json({
                    ...home,
                    payment_status: payment ? payment.status : 'unpaid',
                    paid_date: payment ? payment.paid_date : null,
                    collected_amount: payment ? payment.collected_amount : 0
                });
            }
        );
    });
});

// POST /api/homes
router.post('/', authMiddleware, (req, res) => {
    const { home_id, customer_name, phone, set_top_box_id, monthly_amount } = req.body;

    if (home_id === undefined || home_id === null || !customer_name || !phone || !set_top_box_id || monthly_amount === undefined || monthly_amount === null) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
    INSERT INTO homes (home_id, customer_name, phone, set_top_box_id, monthly_amount)
    VALUES (?, ?, ?, ?, ?)
  `;

    db.run(query, [home_id, customer_name, phone, set_top_box_id, monthly_amount], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'A home with this ID already exists' });
            }
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Fetch the created home
        db.get('SELECT * FROM homes WHERE id = ?', [this.lastID], (err, home) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            // Immediately create a payment record for the current month
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            db.run(
                'INSERT INTO payments (home_id, month, year, status, collected_amount) VALUES (?, ?, ?, ?, ?)',
                [home.home_id, currentMonth, currentYear, 'unpaid', 0],
                (err) => {
                    if (err && !err.message.includes('UNIQUE constraint failed')) {
                        console.error('Database error initializing payment:', err);
                    }
                    res.status(201).json(home);
                }
            );
        });
    });
});

// PUT /api/homes/:homeId - Edit Customer
router.put('/:homeId', authMiddleware, (req, res) => {
    const homeId = req.params.homeId;
    const { customer_name, phone, set_top_box_id, monthly_amount } = req.body;

    if (!customer_name || !phone || !set_top_box_id || monthly_amount === undefined || monthly_amount === null) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
        UPDATE homes 
        SET customer_name = ?, phone = ?, set_top_box_id = ?, monthly_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE home_id = ?
    `;

    db.run(query, [customer_name, phone, set_top_box_id, monthly_amount, homeId], function (err) {
        if (err) {
            console.error('Database error during update:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Home not found' });
        }

        db.get('SELECT * FROM homes WHERE home_id = ?', [homeId], (err, home) => {
            if (err) {
                console.error('Database error fetching updated home:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(home);
        });
    });
});

// DELETE /api/homes/:homeId - Delete Customer
router.delete('/:homeId', authMiddleware, (req, res) => {
    const homeId = req.params.homeId;

    // First delete related payments
    db.run('DELETE FROM payments WHERE home_id = ?', [homeId], (err) => {
        if (err) {
            console.error('Database error deleting payments:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Then delete home
        db.run('DELETE FROM homes WHERE home_id = ?', [homeId], function (err) {
            if (err) {
                console.error('Database error deleting home:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Home not found' });
            }

            res.json({ success: true });
        });
    });
});

module.exports = router;
