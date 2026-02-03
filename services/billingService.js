const { db } = require('../database');

/**
 * Ensures all homes have a payment record for the current month.
 * This is idempotent and can be run multiple times.
 */
const initMonthlyReset = () => {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        console.log(`[BillingService] Running monthly reset check for ${currentMonth}/${currentYear}...`);

        // SQL to insert missing payment records for the current month
        const query = `
            INSERT INTO payments (home_id, month, year, status, collected_amount)
            SELECT home_id, ?, ?, 'unpaid', 0 
            FROM homes 
            WHERE home_id NOT IN (
                SELECT home_id FROM payments WHERE month = ? AND year = ?
            )
        `;

        db.run(query, [currentMonth, currentYear, currentMonth, currentYear], function (err) {
            if (err) {
                console.error('[BillingService] Error creating monthly records:', err);
                reject(err);
            } else {
                if (this.changes > 0) {
                    console.log(`[BillingService] Successfully initialized ${this.changes} new payment records for ${currentMonth}/${currentYear}.`);
                } else {
                    console.log(`[BillingService] No new records needed for ${currentMonth}/${currentYear}.`);
                }
                resolve(this.changes);
            }
        });
    });
};

/**
 * Starts a periodic checker for the monthly reset.
 * Runs on startup and then every hour.
 */
const startBillingService = () => {
    // Run immediately on startup
    initMonthlyReset().catch(err => console.error('[BillingService] Startup check failed:', err));

    // Schedule to run every hour (3600000 ms)
    // This ensures that even if the server runs past midnight on the 1st, it will trigger within an hour.
    setInterval(() => {
        initMonthlyReset().catch(err => console.error('[BillingService] Periodic check failed:', err));
    }, 3600000);

    console.log('[BillingService] Monthly reset service started (Interval: 1 hour)');
};

module.exports = {
    initMonthlyReset,
    startBillingService
};
