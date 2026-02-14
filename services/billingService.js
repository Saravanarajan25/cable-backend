const Home = require('../models/Home');
const Payment = require('../models/Payment');

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
        // Get all homes
        const homes = await Home.find().lean();

        // Get all existing payments for this month
        const existingPayments = await Payment.find({
            month: currentMonth,
            year: currentYear
        }).lean();

        // Find homes without payment records
        const homesWithoutPayment = homes.filter(home =>
            !existingPayments.some(p => p.home_id === home.home_id)
        );

        if (homesWithoutPayment.length > 0) {
            const newPayments = homesWithoutPayment.map(home => ({
                home_id: home.home_id,
                month: currentMonth,
                year: currentYear,
                status: 'unpaid'
            }));

            await Payment.insertMany(newPayments);
            console.log(`[BillingService] Successfully initialized ${newPayments.length} new payment records for ${currentMonth}/${currentYear}.`);
            return newPayments.length;
        } else {
            console.log(`[BillingService] No new records needed for ${currentMonth}/${currentYear}.`);
            return 0;
        }
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
