
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to Database
const dbPath = path.resolve(__dirname, '../backnd/database/cablepay.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

// Queries provided by User
const queries = [
    {
        name: "1. Check for Duplicate Payments",
        sql: `SELECT home_id, month, year, COUNT(*) as count 
              FROM payments 
              GROUP BY home_id, month, year 
              HAVING COUNT(*) > 1`
    },
    {
        name: "2. Check for Orphans",
        sql: `SELECT * FROM payments 
              WHERE home_id NOT IN (SELECT home_id FROM homes)`
    },
    {
        name: "3. Verify Dashboard Logic (Total Paid for Current Month)",
        sql: `SELECT COUNT(*) as Paid_Count 
              FROM payments 
              WHERE status = 'paid' AND month = ? AND year = ?`,
        params: () => {
            const now = new Date();
            return [now.getMonth() + 1, now.getFullYear()];
        }
    },
    {
        name: "4. Audit Multi-Month Logic (Date Mismatch)",
        sql: `SELECT home_id, month, year, paid_date 
              FROM payments 
              WHERE status = 'paid' 
              AND strftime('%m', paid_date) != 
                CASE 
                    WHEN length(month) = 1 THEN '0' || month 
                    ELSE month 
                END
             -- Note: Only applies if paid_date IS NOT NULL. 
             -- Also: This query checks if the payment for 'January' was physically made in 'January'.
             -- The user request says: "Finds payments where the month is NOT the same as the month in paid_date"
             -- Actually, paying for January in February IS valid for arrear payments. 
             -- But the user calls this an Audit/Logic check. 
             -- If the intent is to find Backdated/Future dated payments that look wrong, we run it.
             -- Warning: This might Flag valid arrear payments. We will Log them as INFO.`
    }
];

function runQueries() {
    let completed = 0;

    // We'll run them sequentially to avoid mess
    const runNext = (index) => {
        if (index >= queries.length) {
            console.log('\n✅ SQL Integrity Check Complete');
            db.close();
            return;
        }

        const q = queries[index];
        const params = q.params ? q.params() : [];

        console.log(`\nRunning: ${q.name}...`);

        db.all(q.sql, params, (err, rows) => {
            if (err) {
                console.error(`ERROR in ${q.name}:`, err.message);
            } else {
                if (rows.length === 0) {
                    console.log(`[PASS] No issues found (0 rows returned).`);
                } else {
                    console.log(`[ALERT] ${rows.length} rows returned!`);
                    if (q.name.includes("Dashboard")) {
                        console.log(`[INFO] Current Paid Count: ${rows[0].Paid_Count}`);
                    } else {
                        console.table(rows);
                    }
                }
            }
            runNext(index + 1);
        });
    };

    runNext(0);
}

runQueries();
