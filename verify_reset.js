const { db, initDatabase } = require('./database');
const { initMonthlyReset } = require('./services/billingService');

async function testReset() {
    console.log('--- Testing Monthly Reset Logic ---');
    try {
        await initDatabase();

        // 1. Check current records for a sample month (e.g., next month)
        const now = new Date();
        const nextMonth = (now.getMonth() + 2) % 12 || 12;
        const nextMonthYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();

        console.log(`Simulating reset for ${nextMonth}/${nextMonthYear}...`);

        // We need to temporarily mock the date in initMonthlyReset or manually pass it.
        // Since initMonthlyReset uses 'new Date()', we can't easily mock it without a library.
        // Let's create a specialized test function or manually run the query.

        const query = `
            INSERT INTO payments (home_id, month, year, status, collected_amount)
            SELECT home_id, ?, ?, 'unpaid', 0 
            FROM homes 
            WHERE home_id NOT IN (
                SELECT home_id FROM payments WHERE month = ? AND year = ?
            )
        `;

        return new Promise((resolve, reject) => {
            db.run(query, [nextMonth, nextMonthYear, nextMonth, nextMonthYear], function (err) {
                if (err) {
                    console.error('   ❌ Reset query failed:', err);
                    reject(err);
                } else {
                    console.log(`   ✅ Successfully created ${this.changes} records for simulated month.`);

                    // Verify records exist
                    db.get('SELECT COUNT(*) as count FROM payments WHERE month = ? AND year = ?', [nextMonth, nextMonthYear], (err, row) => {
                        if (err || row.count === 0) {
                            console.error('   ❌ Verification failed: Records not found.');
                            reject(err || 'No records');
                        } else {
                            console.log(`   ✅ Verified ${row.count} records exist for simulated month.`);
                            resolve();
                        }
                    });
                }
            });
        });

    } catch (e) {
        console.error('--- Reset Verification Failed ---');
        console.error(e);
        process.exit(1);
    } finally {
        db.close();
    }
}

testReset();
