const express = require('express');
const Home = require('../models/Home');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/mark-paid
router.post('/mark-paid', authMiddleware, async (req, res) => {
    const { home_id, month, year } = req.body;

    if (!home_id || !month || !year) {
        return res.status(400).json({ error: 'home_id, month, and year are required' });
    }

    const paid_date = new Date(); // Mongoose will store as Date object

    try {
        const home = await Home.findOne({ home_id });

        if (!home) {
            return res.status(404).json({ error: 'Home not found' });
        }

        let payment = await Payment.findOneAndUpdate(
            { home_id, month, year },
            {
                $set: {
                    status: 'paid',
                    paid_date: paid_date
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        // Preserve API structure: include collected_amount
        payment.collected_amount = home.monthly_amount;

        res.json(payment);
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
        const home = await Home.findOne({ home_id: homeId }).lean();
        if (!home) {
            return res.json({ status: 'unpaid', paid_date: null, collected_amount: 0 });
        }

        const payment = await Payment.findOne({ home_id: homeId, month, year }).lean();

        if (!payment) {
            return res.json({ status: 'unpaid', paid_date: null, collected_amount: 0 });
        }

        // Add collected_amount if paid
        res.json({
            ...payment,
            collected_amount: payment.status === 'paid' ? home.monthly_amount : 0
        });
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
        const payment = await Payment.findOneAndUpdate(
            { home_id, month, year },
            {
                $set: {
                    status: 'unpaid',
                    paid_date: null
                }
            },
            { new: true }
        ).lean();

        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        // Preserve API structure
        payment.collected_amount = 0;

        res.json(payment);
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
        const homes = await Home.find().sort({ home_id: 1 }).lean();

        // Build payment query
        const paymentQuery = { month, year };

        if (status) {
            paymentQuery.status = status;
        }

        if (fromDate && toDate) {
            paymentQuery.paid_date = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate + 'T23:59:59.999Z')
            };
        } else if (fromDate) {
            // For single day filtering (YYYY-MM-DD pattern match replacement)
            // match filtered date entire day
            const startStr = fromDate;
            // Assuming fromDate is YYYY-MM-DD
            const start = new Date(startStr);
            const end = new Date(startStr + 'T23:59:59.999Z');

            paymentQuery.paid_date = {
                $gte: start,
                $lte: end
            };
        }

        const payments = await Payment.find(paymentQuery).lean();

        // Map homes with payment status
        // Note: Logic here filters 'result' after mapping based on status request if present.
        // However, if we filtered payments by status in DB query, 'payments' list only has those.
        // If status filter is 'paid', we only got 'paid' payments.
        // Homes that don't match that payment status will show as 'unpaid' (default) in mapping?
        // Wait, original logic:
        // 1. Get ALL homes.
        // 2. Get filtered payments.
        // 3. Map homes -> look up payment.
        // 4. Filter result by status.

        // If `status` param was passed to SQL, it filtered the payments list.
        // Then `result = homes.map(...)`.
        // Then `filtered = result.filter(...)`.

        // If status='paid':
        // SQL returned only paid payments.
        // Map: Home1 (paid) -> status='paid'. Home2 (unpaid) -> match not found -> status='unpaid'.
        // Filter result (status='paid'): ONLY Home1 returned. Correct.

        // If status='unpaid':
        // SQL returned only unpaid payments.
        // Map: Home1 (paid) -> match not found -> status='unpaid'??
        // Wait. If Home1 is PAID, but SQL filtered it out, `payment` variable is undefined.
        // Then `payment ? payment.status : 'unpaid'` returns 'unpaid'.
        // So Home1 (which is PAID) would be shown as 'unpaid' in the object?
        // AND then included in the final filter?
        // This logic seems potentially flawed in the original code if status filter was applied to SQL query?
        // Let's re-read original `payments.js`:
        /*
            if (status) {
                paymentQueryText += ` AND status = $${paramIndex}`;
            }
            ...
            const { rows: payments } = await query(paymentQueryText, params);
            ...
            const result = homes.map(...) -> payment_status: payment ? payment.status : 'unpaid'
            ...
            const filtered = status ? result.filter(...) : result;
        */
        // YES. In original code, if I ask for 'unpaid', SQL gets 'unpaid' records.
        // A 'paid' home won't be in `payments` array.
        // It defaults to 'unpaid' in the map.
        // Then it passes the `filter(r => r.payment_status === status)` check.
        // So a PAID home becomes UNPAID in the report?

        // Wait. This is the Monthly Report logic.
        // If I haven't paid, my status is 'unpaid'.
        // If I have paid, my status is 'paid'.
        // If I filter for 'unpaid', I want to see homes that haven't paid.
        // If a home IS paid, and I filter payment query by 'unpaid', that home is NOT in the payments list.
        // So `payments.find` returns undefined.
        // So `payment_status` becomes 'unpaid'.
        // So it shows up in "Unpaid" report even if it is Paid!

        // This looks like a bug in the SQL implementation too! 
        // OR, does `payments` table contain 'unpaid' rows for everyone?
        // YES! The `billingService` creates 'unpaid' rows for EVERYONE at start of month.
        // So a PAID home has a record with status='paid'.
        // An UNPAID home has a record with status='unpaid'.
        // If I filter SQL by `status='unpaid'`, I get the unpaid records.
        // The Paid home has a record, but its status is 'paid'. It is NOT returned by SQL.
        // So `payments.find` returns undefined.
        // Default is 'unpaid'.
        // So the Paid home appears as Unpaid.

        // CRITICAL CHECK: Does `payments` table contain ONE record per home per month? Yes, unique constraint.
        // So if I update it to 'paid', the 'unpaid' record is gone (updated).
        // So correct logic: If I filter payments by 'unpaid', I don't get the 'paid' ones.
        // But the mapping defaults to 'unpaid' if missing.
        // So 'paid' homes (missing from list) ==> become 'unpaid' in UI.
        // THIS IS A BUG in the strict sense, unless "Unpaid" implies "No payment record found".
        // BUT, since we have `billingService` ensuring records exist, a missing record implies... what?

        // To strictly preserve behavior: I must replicate this "bug" or "feature".
        // The prompt says "Preserve 100% of existing business logic".
        // So I will replicate strict behavior.
        // HOWEVER, Mongoose `find` works same way.

        const result = homes.map(home => {
            const payment = payments.find(p => p.home_id === home.home_id);
            return {
                ...home,
                payment_status: payment ? payment.status : 'unpaid',
                paid_date: payment ? payment.paid_date : null,
                collected_amount: (payment && payment.status === 'paid') ? home.monthly_amount : 0
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
