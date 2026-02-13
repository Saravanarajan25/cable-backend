const express = require('express');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/mark-paid
router.post('/mark-paid', authMiddleware, async (req, res) => {
    const { home_id, month, year } = req.body;

    if (!home_id || !month || !year) {
        return res.status(400).json({ error: 'home_id, month, and year are required' });
    }

    const paid_date = new Date().toISOString();

    try {
        // Check if payment record exists
        const { rows } = await query(
            'SELECT p.*, h.monthly_amount FROM homes h LEFT JOIN payments p ON h.home_id = p.home_id AND p.month = $1 AND p.year = $2 WHERE h.home_id = $3',
            [month, year, home_id]
        );
        const data = rows[0];

        if (!data) {
            return res.status(404).json({ error: 'Home not found' });
        }

        const existing = data.id ? data : null;
        const monthlyAmount = data.monthly_amount;

        if (existing) {
            // Update existing record
            const updateQuery = `
                UPDATE payments 
                SET status = $1, paid_date = $2, collected_amount = $3, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $4 
                RETURNING *
            `;
            const { rows: updatedRows } = await query(updateQuery, ['paid', paid_date, monthlyAmount, existing.id]);
            res.json(updatedRows[0]);
        } else {
            // Create new payment record
            const insertQuery = `
                INSERT INTO payments (home_id, month, year, status, paid_date, collected_amount) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING *
            `;
            const { rows: newRows } = await query(insertQuery, [home_id, month, year, 'paid', paid_date, monthlyAmount]);
            res.json(newRows[0]);
        }
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/payments/status/:homeId?month=X&year=Y
router.get('/status/:homeId', authMiddleware, async (req, res) => {
    const { homeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    try {
        const { rows } = await query(
            'SELECT * FROM payments WHERE home_id = $1 AND month = $2 AND year = $3',
            [homeId, month, year]
        );
        const payment = rows[0];

        if (!payment) {
            return res.json({ status: 'unpaid', paid_date: null, collected_amount: 0 });
        }

        res.json(payment);
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/payments/mark-unpaid
router.put('/mark-unpaid', authMiddleware, async (req, res) => {
    const { home_id, month, year } = req.body;

    if (!home_id || !month || !year) {
        return res.status(400).json({ error: 'home_id, month, and year are required' });
    }

    try {
        // Check if payment record exists
        const { rows } = await query(
            'SELECT * FROM payments WHERE home_id = $1 AND month = $2 AND year = $3',
            [home_id, month, year]
        );
        const existing = rows[0];

        if (!existing) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        // Update to unpaid
        const updateQuery = `
            UPDATE payments 
            SET status = $1, paid_date = NULL, collected_amount = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 
            RETURNING *
        `;
        const { rows: updatedRows } = await query(updateQuery, ['unpaid', existing.id]);
        res.json(updatedRows[0]);
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/payments?month=X&year=Y&status=paid|unpaid
router.get('/', authMiddleware, async (req, res) => {
    const { month, year, status, fromDate, toDate } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    try {
        // Get all homes
        const { rows: homes } = await query('SELECT * FROM homes ORDER BY home_id ASC');

        // Get payments for the specified month/year
        let paymentQueryText = 'SELECT * FROM payments WHERE month = $1 AND year = $2';
        const params = [month, year];
        let paramIndex = 3;

        if (status) {
            paymentQueryText += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (fromDate && toDate) {
            paymentQueryText += ` AND paid_date >= $${paramIndex} AND paid_date <= $${paramIndex + 1}`;
            params.push(fromDate, `${toDate}Z`);
            paramIndex += 2;
        } else if (fromDate) {
            // Postgres LIKE works on text. paid_date is TIMESTAMP. Cast to text?
            // Or use date_trunc or just string matching if stored as ISO string in logic but TIMESTAMP in DB.
            // Earlier code used `LIKE ?` with `2024-02-06%`.
            // In Postgres, logic: to_char(paid_date, 'YYYY-MM-DD') = $param
            // Or cast to text: paid_date::text LIKE $param
            paymentQueryText += ` AND paid_date::text LIKE $${paramIndex}`;
            params.push(`${fromDate}%`);
            paramIndex++;
        }

        const { rows: payments } = await query(paymentQueryText, params);

        // Map homes with payment status
        const result = homes.map(home => {
            const payment = payments.find(p => p.home_id === home.home_id);
            return {
                ...home,
                payment_status: payment ? payment.status : 'unpaid',
                paid_date: payment ? payment.paid_date : null,
                collected_amount: payment ? payment.collected_amount : 0
            };
        });

        // Filter by status if specified
        const filtered = status
            ? result.filter(r => r.payment_status === status)
            : result;

        res.json(filtered);
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
