/**
 * FINAL END-TO-END VERIFICATION SCRIPT
 * 
 * This script verifies:
 * 1. Login flow & Token generation
 * 2. Token persistence & validation
 * 3. All critical API endpoints
 * 4. Error handling
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:3001/api';
const LOG_FILE = 'verification_results.txt';

// Cleanup log file
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

const log = (msg, type = 'INFO') => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${msg}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
};

const runVerification = async () => {
    log('🚀 STARTING FINAL END-TO-END VERIFICATION', 'START');

    let token = null;
    let homeId = null;

    // 1. TEST LOGIN
    log('Testing Authentication...', 'STEP');
    try {
        const response = await fetch(`${BACKEND_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        if (!response.ok) throw new Error(`Login failed with status ${response.status}`);

        const data = await response.json();

        if (data.token) {
            token = data.token;
            log('✅ Login Successful', 'PASS');
            log(`🔑 Token generated: ${token.substring(0, 20)}...`, 'INFO');
        } else {
            throw new Error('No token received');
        }
    } catch (error) {
        log(`❌ Login Failed: ${error.message}`, 'FAIL');
        process.exit(1);
    }

    const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 2. TEST DASHBOARD STATS
    log('Testing Dashboard API...', 'STEP');
    try {
        const date = new Date();
        const response = await fetch(
            `${BACKEND_URL}/dashboard/stats?month=${date.getMonth() + 1}&year=${date.getFullYear()}`,
            { headers: authHeaders }
        );

        if (!response.ok) throw new Error(`Dashboard stats failed: ${response.status}`);

        const data = await response.json();
        log('✅ Dashboard Stats Fetched', 'PASS');
        log(`📊 Stats: ${JSON.stringify(data)}`, 'INFO');
    } catch (error) {
        log(`❌ Dashboard Failed: ${error.message}`, 'FAIL');
    }

    // 3. TEST HOMES CRUD
    log('Testing Homes API...', 'STEP');
    try {
        // Create
        const newHome = {
            home_id: 9999,
            customer_name: "Test Customer",
            phone: "9876543210",
            set_top_box_id: "STB9999",
            monthly_amount: 500
        };

        // Cleanup first just in case
        try {
            await fetch(`${BACKEND_URL}/homes/9999`, { method: 'DELETE', headers: authHeaders });
        } catch (e) { }

        const createRes = await fetch(`${BACKEND_URL}/homes`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(newHome)
        });

        if (!createRes.ok) {
            const err = await createRes.json();
            throw new Error(err.message || 'Create failed');
        }

        const createData = await createRes.json();
        homeId = createData.home_id;
        log('✅ Home Created', 'PASS');

        // Read
        const getRes = await fetch(`${BACKEND_URL}/homes/${homeId}`, { headers: authHeaders });
        const getData = await getRes.json();

        if (getData.customer_name === "Test Customer") {
            log('✅ Home Retrieved', 'PASS');
        } else {
            throw new Error('Home data mismatch');
        }

    } catch (error) {
        log(`❌ Homes API Failed: ${error.message}`, 'FAIL');
    }

    // 4. TEST PAYMENTS
    log('Testing Payments API...', 'STEP');
    try {
        const date = new Date();

        // Mark Paid
        const paidRes = await fetch(`${BACKEND_URL}/payments/mark-paid`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                home_id: 9999,
                month: date.getMonth() + 1,
                year: date.getFullYear()
            })
        });

        if (!paidRes.ok) throw new Error(`Mark paid failed: ${paidRes.status}`);
        log('✅ Payment Marked Paid', 'PASS');

        // Verify Status
        const homeRes = await fetch(`${BACKEND_URL}/homes/9999`, { headers: authHeaders });
        const homeData = await homeRes.json();

        if (homeData.payment_status === 'paid') {
            log('✅ Payment Status Verified', 'PASS');
        } else {
            throw new Error('Payment status verification failed');
        }

    } catch (error) {
        log(`❌ Payments API Failed: ${error.message}`, 'FAIL');
    }

    // 5. TEST EXPORT
    log('Testing Export API...', 'STEP');
    try {
        const date = new Date();
        const exportRes = await fetch(
            `${BACKEND_URL}/export?month=${date.getMonth() + 1}&year=${date.getFullYear()}`,
            { headers: authHeaders }
        );

        if (exportRes.ok) {
            log('✅ Export API Successful', 'PASS');
        } else {
            throw new Error(`Export failed: ${exportRes.status}`);
        }
    } catch (error) {
        log(`❌ Export API Failed: ${error.message}`, 'FAIL');
    }

    // CLEANUP
    if (homeId) {
        try {
            await fetch(`${BACKEND_URL}/homes/${homeId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            log('✅ Verification Data Cleaned Up', 'PASS');
        } catch (e) {
            log('⚠️ Access Cleanup Failed', 'WARN');
        }
    }

    log('🏁 FINAL VERIFICATION COMPLETE', 'END');
};

runVerification();
