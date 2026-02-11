const express = require('express');
const { db } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/mark-paid
router.post('/mark-paid', authMiddleware, (req, res) => {
    const { home_id, month, year } = req.body;

    if (!home_id || !month || !year) {
        return res.status(400).json({ error: 'home_id, month, and year are required' });
    }

    const paid_date = new Date().toISOString();

    // Check if payment record exists
    db.get(
        'SELECT p.*, h.monthly_amount FROM homes h LEFT JOIN payments p ON h.home_id = p.home_id AND p.month = ? AND p.year = ? WHERE h.home_id = ?',
        [month, year, home_id],
        (err, data) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!data) {
                return res.status(404).json({ error: 'Home not found' });
            }

            const existing = data.id ? data : null;
            const monthlyAmount = data.monthly_amount;

            if (existing) {
                // Update existing record
                // Ensures we update status to 'paid', set date to NOW, and ensure amount is set
                db.run(
                    'UPDATE payments SET status = ?, paid_date = ?, collected_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['paid', paid_date, monthlyAmount, existing.id],
                    function (err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        // Fetch updated record to return
                        db.get('SELECT * FROM payments WHERE id = ?', [existing.id], (err, payment) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                            res.json(payment);
                        });
                    }
                );
            } else {
                // Create new payment record for that specific month/year
                // This handles cases where we are paying for a future month or a past month that wasn't pre-populated
                db.run(
                    'INSERT INTO payments (home_id, month, year, status, paid_date, collected_amount) VALUES (?, ?, ?, ?, ?, ?)',
                    [home_id, month, year, 'paid', paid_date, monthlyAmount],
                    function (err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        // Fetch created record
                        db.get('SELECT * FROM payments WHERE id = ?', [this.lastID], (err, payment) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                            res.json(payment);
                        });
                    }
                );
            }
        }
    );
});

// GET /api/payments/status/:homeId?month=X&year=Y
router.get('/status/:homeId', authMiddleware, (req, res) => {
    const { homeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    db.get(
        'SELECT * FROM payments WHERE home_id = ? AND month = ? AND year = ?',
        [homeId, month, year],
        (err, payment) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!payment) {
                return res.json({ status: 'unpaid', paid_date: null, collected_amount: 0 });
            }

            res.json(payment);
        }
    );
});

// PUT /api/payments/mark-unpaid
router.put('/mark-unpaid', authMiddleware, (req, res) => {
    const { home_id, month, year } = req.body;

    if (!home_id || !month || !year) {
        return res.status(400).json({ error: 'home_id, month, and year are required' });
    }

    // Check if payment record exists
    db.get(
        'SELECT * FROM payments WHERE home_id = ? AND month = ? AND year = ?',
        [home_id, month, year],
        (err, existing) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!existing) {
                return res.status(404).json({ error: 'Payment record not found' });
            }

            // Update to unpaid
            db.run(
                'UPDATE payments SET status = ?, paid_date = NULL, collected_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['unpaid', existing.id],
                function (err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    // Fetch updated record
                    db.get('SELECT * FROM payments WHERE id = ?', [existing.id], (err, payment) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }
                        res.json(payment);
                    });
                }
            );
        }
    );
});

// GET /api/payments?month=X&year=Y&status=paid|unpaid
router.get('/', authMiddleware, (req, res) => {
    const { month, year, status } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    // Get all homes
    db.all('SELECT * FROM homes ORDER BY home_id ASC', [], (err, homes) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Get payments for the specified month/year
        let paymentQuery = 'SELECT * FROM payments WHERE month = ? AND year = ?';
        const params = [month, year];

        if (status) {
            // We do NOT filter by status in the SQL query anymore.
            // Why? Because if we filter for 'unpaid', the DB returns nothing for paid homes.
            // But we need to know they ARE paid so we don't default them to 'unpaid' in the map() below.
            // filtering happens AFTER mapping.
            // paymentQuery += ' AND status = ?';
            // params.push(status);
        }

        const { fromDate, toDate } = req.query;
        if (fromDate && toDate) {
            paymentQuery += ' AND paid_date >= ? AND paid_date <= ?';
            params.push(`${fromDate}`, `${toDate}Z`); // Simple lexicographical comparison for ISO strings
        } else if (fromDate) {
            paymentQuery += ' AND paid_date LIKE ?';
            params.push(`${fromDate}%`);
        }

        db.all(paymentQuery, params, (err, payments) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

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
        });
    });
});

module.exports = router;
