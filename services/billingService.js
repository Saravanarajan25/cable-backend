const { query } = require('../db');

/**
 * Ensures all homes have a payment record for the current month.
 * This is idempotent and can be run multiple times.
 */
const initMonthlyReset = async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    console.log(`[BillingService] Running monthly reset check for ${currentMonth}/${currentYear}...`);

    try {
        // SQL to insert missing payment records for the current month
        // Postgres syntax: use $1, $2, etc.
        const sql = `
            INSERT INTO payments (home_id, month, year, status, collected_amount)
            SELECT home_id, $1, $2, 'unpaid', 0 
            FROM homes 
            WHERE home_id NOT IN (
                SELECT home_id FROM payments WHERE month = $3 AND year = $4
            )
        `;

        const { rowCount } = await query(sql, [currentMonth, currentYear, currentMonth, currentYear]);

        if (rowCount > 0) {
            console.log(`[BillingService] Successfully initialized ${rowCount} new payment records for ${currentMonth}/${currentYear}.`);
        } else {
            console.log(`[BillingService] No new records needed for ${currentMonth}/${currentYear}.`);
        }
        return rowCount;
    } catch (err) {
        console.error('[BillingService] Error creating monthly records:', err);
        throw err;
    }
};

/**
 * Starts a periodic checker for the monthly reset.
 * Runs on startup and then every hour.
 */
const startBillingService = () => {
    // Run immediately on startup
    initMonthlyReset().catch(err => console.error('[BillingService] Startup check failed:', err));

    // Schedule to run every hour (3600000 ms)
    setInterval(() => {
        initMonthlyReset().catch(err => console.error('[BillingService] Periodic check failed:', err));
    }, 3600000);

    console.log('[BillingService] Monthly reset service started (Interval: 1 hour)');
};

module.exports = {
    initMonthlyReset,
    startBillingService
};
