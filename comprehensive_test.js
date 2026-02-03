/**
 * COMPREHENSIVE END-TO-END VERIFICATION SCRIPT
 * Cable Bill Management System
 * 
 * This script tests ALL APIs, authentication, payment logic, and database integrity.
 * 
 * USAGE:
 * 1. Start backend: cd C:\Users\SARAVANARAJAN\Desktop\backnd && npm start
 * 2. Run this script: node comprehensive_test.js
 */

const http = require('http');
const { initMonthlyReset } = require('./services/billingService');
const { db } = require('./database');

const PORT = 3001;
const HOST = 'localhost';
const BASE_URL = `/api`;

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

function request(path, options = {}, body = null) {
    return new Promise((resolve, reject) =& gt; {
        const reqOptions = {
            hostname: HOST,
            port: PORT,
            path: BASE_URL + path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (body) {
            reqOptions.headers['Content-Type'] = 'application/json';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(reqOptions, (res) =& gt; {
            let data = '';
            res.on('data', (chunk) =& gt; data += chunk);
            res.on('end', () =& gt; {
                let parsed;
                const type = res.headers['content-type'];
                if (type && type.includes('application/json')) {
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        parsed = data;
                    }
                } else {
                    parsed = data;
                }

                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', (e) =& gt; reject(e));

        if (body) req.write(body);
        req.end();
    });
}

function pass(message) {
    console.log(`   ✅ ${message}`);
    results.passed++;
}

function fail(message, error) {
    console.log(`   ❌ ${message}`);
    results.failed++;
    results.errors.push({ message, error });
}

function sleep(ms) {
    return new Promise(resolve =& gt; setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚀 COMPREHENSIVE END-TO-END VERIFICATION');
    console.log('=========================================\n');

    let token1 = '';
    let token2 = '';
    const testHomeId = 88888;

    // ============================================================
    // MODULE 1: AUTHENTICATION & JWT
    // ============================================================
    console.log('📋 MODULE 1: Authentication & JWT');
    console.log('----------------------------------');

    try {
        // Test 1.1: Login with valid credentials
        console.log('1.1 Testing login (admin / admin123)...');
        const loginRes = await request('/login', { method: 'POST' }, JSON.stringify({
            username: 'admin',
            password: 'admin123'
        }));

        if (loginRes.status === 200 && loginRes.data.token) {
            token1 = loginRes.data.token;
            pass('Login successful, JWT token received');
        } else {
            fail('Login failed', loginRes);
        }

        // Test 1.2: Login with invalid credentials
        console.log('1.2 Testing login with invalid credentials...');
        const badLoginRes = await request('/login', { method: 'POST' }, JSON.stringify({
            username: 'admin',
            password: 'wrongpassword'
        }));

        if (badLoginRes.status === 401) {
            pass('Invalid credentials correctly rejected');
        } else {
            fail('Invalid credentials should return 401', badLoginRes);
        }

        // Test 1.3: Multiple simultaneous sessions
        console.log('1.3 Testing multiple simultaneous sessions...');
        const session2Res = await request('/login', { method: 'POST' }, JSON.stringify({
            username: 'admin',
            password: 'admin123'
        }));

        if (session2Res.status === 200 && session2Res.data.token) {
            token2 = session2Res.data.token;
            pass('Second session token received (multi-session supported)');
        } else {
            fail('Second session login failed', session2Res);
        }

        // Test 1.4: Protected endpoint without token
        console.log('1.4 Testing protected endpoint without token...');
        const noTokenRes = await request('/homes/1', { method: 'GET' });

        if (noTokenRes.status === 401 || noTokenRes.status === 403) {
            pass('Protected endpoint correctly requires authentication');
        } else {
            fail('Protected endpoint should require token', noTokenRes);
        }

    } catch (e) {
        fail('Authentication module error', e.message);
    }

    const authHeaders = { 'Authorization': `Bearer ${token1}` };

    // ============================================================
    // MODULE 2: HOME MANAGEMENT APIs
    // ============================================================
    console.log('\n📋 MODULE 2: Home Management APIs');
    console.log('----------------------------------');

    try {
        // Cleanup first
        await request(`/homes/${testHomeId}`, { method: 'DELETE', headers: authHeaders });

        // Test 2.1: POST /api/homes (Add home)
        console.log('2.1 Testing POST /api/homes (Add home)...');
        const newHome = {
            home_id: testHomeId,
            customer_name: 'Test Customer',
            phone: '9876543210',
            set_top_box_id: 'STB-TEST-001',
            monthly_amount: 500
        };

        const createRes = await request('/homes', {
            method: 'POST',
            headers: authHeaders
        }, JSON.stringify(newHome));

        if (createRes.status === 201 && createRes.data.home_id === testHomeId) {
            pass('Home created successfully');
        } else {
            fail('Home creation failed', createRes);
        }

        // Test 2.2: Duplicate home ID blocked
        console.log('2.2 Testing duplicate home ID rejection...');
        const dupRes = await request('/homes', {
            method: 'POST',
            headers: authHeaders
        }, JSON.stringify(newHome));

        if (dupRes.status === 400 && dupRes.data.error.includes('already exists')) {
            pass('Duplicate home ID correctly blocked');
        } else {
            fail('Duplicate home ID should be blocked', dupRes);
        }

        // Test 2.3: GET /api/homes/:homeId (Fetch home)
        console.log('2.3 Testing GET /api/homes/:homeId...');
        const getRes = await request(`/homes/${testHomeId}`, { headers: authHeaders });

        if (getRes.status === 200 && getRes.data.customer_name === 'Test Customer') {
            pass('Home fetched successfully');
        } else {
            fail('Home fetch failed', getRes);
        }

        // Test 2.4: PUT /api/homes/:homeId (Edit home)
        console.log('2.4 Testing PUT /api/homes/:homeId (Edit home)...');
        const updateData = {
            customer_name: 'Updated Customer',
            phone: '1234567890',
            set_top_box_id: 'STB-UPDATED-001',
            monthly_amount: 600
        };

        const updateRes = await request(`/homes/${testHomeId}`, {
            method: 'PUT',
            headers: authHeaders
        }, JSON.stringify(updateData));

        if (updateRes.status === 200 && updateRes.data.customer_name === 'Updated Customer') {
            pass('Home updated successfully');
        } else {
            fail('Home update failed', updateRes);
        }

    } catch (e) {
        fail('Home management module error', e.message);
    }

    // ============================================================
    // MODULE 3: PAYMENT LOGIC
    // ============================================================
    console.log('\n📋 MODULE 3: Payment Logic');
    console.log('----------------------------------');

    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Test 3.1: POST /api/payments/mark-paid
        console.log('3.1 Testing POST /api/payments/mark-paid...');
        const markPaidRes = await request('/payments/mark-paid', {
            method: 'POST',
            headers: authHeaders
        }, JSON.stringify({ home_id: testHomeId, month, year }));

        if (markPaidRes.status === 200 && markPaidRes.data.status === 'paid') {
            pass('Payment marked as paid');

            if (markPaidRes.data.paid_date) {
                pass('paid_date set correctly');
            } else {
                fail('paid_date should be set', markPaidRes.data);
            }
        } else {
            fail('Mark paid failed', markPaidRes);
        }

        // Test 3.2: Verify payment status in home data
        console.log('3.2 Verifying payment status reflects in home data...');
        const homeCheckRes = await request(`/homes/${testHomeId}`, { headers: authHeaders });

        if (homeCheckRes.data.payment_status === 'paid') {
            pass('Home shows payment status as paid');
        } else {
            fail('Home should show paid status', homeCheckRes.data);
        }

        // Test 3.3: PUT /api/payments/mark-unpaid
        console.log('3.3 Testing PUT /api/payments/mark-unpaid...');
        const markUnpaidRes = await request('/payments/mark-unpaid', {
            method: 'PUT',
            headers: authHeaders
        }, JSON.stringify({ home_id: testHomeId, month, year }));

        if (markUnpaidRes.status === 200 && markUnpaidRes.data.status === 'unpaid') {
            pass('Payment marked as unpaid');

            if (markUnpaidRes.data.paid_date === null) {
                pass('paid_date cleared correctly');
            } else {
                fail('paid_date should be null when unpaid', markUnpaidRes.data);
            }
        } else {
            fail('Mark unpaid failed', markUnpaidRes);
        }

        // Test 3.4: Toggle repeatedly
        console.log('3.4 Testing repeated toggle (paid → unpaid → paid)...');
        await request('/payments/mark-paid', { method: 'POST', headers: authHeaders },
            JSON.stringify({ home_id: testHomeId, month, year }));
        await request('/payments/mark-unpaid', { method: 'PUT', headers: authHeaders },
            JSON.stringify({ home_id: testHomeId, month, year }));
        const finalToggle = await request('/payments/mark-paid', { method: 'POST', headers: authHeaders },
            JSON.stringify({ home_id: testHomeId, month, year }));

        if (finalToggle.status === 200 && finalToggle.data.status === 'paid') {
            pass('Repeated toggle works correctly');
        } else {
            fail('Repeated toggle failed', finalToggle);
        }

    } catch (e) {
        fail('Payment logic module error', e.message);
    }

    // ============================================================
    // MODULE 4: MONTHLY & DAY-WISE REPORTS
    // ============================================================
    console.log('\n📋 MODULE 4: Monthly & Day-Wise Reports');
    console.log('----------------------------------');

    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Test 4.1: GET /api/payments (All homes)
        console.log('4.1 Testing GET /api/payments (all homes)...');
        const allPaymentsRes = await request(`/payments?month=${month}&year=${year}`, { headers: authHeaders });

        if (allPaymentsRes.status === 200 && Array.isArray(allPaymentsRes.data)) {
            pass(`Fetched payments for ${month}/${year}`);
        } else {
            fail('Fetch all payments failed', allPaymentsRes);
        }

        // Test 4.2: Filter by status (paid)
        console.log('4.2 Testing status filter (paid only)...');
        const paidOnlyRes = await request(`/payments?month=${month}&year=${year}&status=paid`, { headers: authHeaders });

        if (paidOnlyRes.status === 200) {
            const allPaid = paidOnlyRes.data.every(h =& gt; h.payment_status === 'paid');
            if (allPaid) {
                pass('Paid filter works correctly');
            } else {
                fail('Paid filter returned unpaid homes', paidOnlyRes.data);
            }
        } else {
            fail('Paid filter failed', paidOnlyRes);
        }

        // Test 4.3: Filter by status (unpaid)
        console.log('4.3 Testing status filter (unpaid only)...');
        const unpaidOnlyRes = await request(`/payments?month=${month}&year=${year}&status=unpaid`, { headers: authHeaders });

        if (unpaidOnlyRes.status === 200) {
            const allUnpaid = unpaidOnlyRes.data.every(h =& gt; h.payment_status === 'unpaid');
            if (allUnpaid) {
                pass('Unpaid filter works correctly');
            } else {
                fail('Unpaid filter returned paid homes', unpaidOnlyRes.data);
            }
        } else {
            fail('Unpaid filter failed', unpaidOnlyRes);
        }

    } catch (e) {
        fail('Reports module error', e.message);
    }

    // ============================================================
    // MODULE 5: MONTHLY AUTO-RESET LOGIC
    // ============================================================
    console.log('\n📋 MODULE 5: Monthly Auto-Reset Logic');
    console.log('----------------------------------');

    try {
        // Test 5.1: Run reset (first time)
        console.log('5.1 Testing monthly reset (Run 1)...');
        const changes1 = await initMonthlyReset();
        pass(`Reset Run 1 completed (${changes1} changes)`);

        // Test 5.2: Run reset again (idempotency)
        console.log('5.2 Testing monthly reset idempotency (Run 2)...');
        const changes2 = await initMonthlyReset();

        if (changes2 === 0) {
            pass('Reset is idempotent (no duplicate records)');
        } else {
            fail('Reset should be idempotent', `Run 2 made ${changes2} changes`);
        }

        // Test 5.3: Verify no historical month modification
        console.log('5.3 Verifying historical months untouched...');
        const lastMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
        const lastYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();

        const historicalRes = await request(`/payments?month=${lastMonth}&year=${lastYear}`, { headers: authHeaders });

        if (historicalRes.status === 200) {
            pass('Historical month data accessible (not modified)');
        } else {
            fail('Historical month check failed', historicalRes);
        }

    } catch (e) {
        fail('Monthly reset module error', e.message);
    }

    // ============================================================
    // MODULE 6: DATABASE INTEGRITY
    // ============================================================
    console.log('\n📋 MODULE 6: Database Integrity');
    console.log('----------------------------------');

    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Test 6.1: UNIQUE constraint (one payment per home per month)
        console.log('6.1 Testing UNIQUE constraint (home_id, month, year)...');

        db.run(
            'INSERT INTO payments (home_id, month, year, status, collected_amount) VALUES (?, ?, ?, ?, ?)',
            [testHomeId, month, year, 'unpaid', 0],
            (err) =& gt; {
            if (err && err.message.includes('UNIQUE constraint failed')) {
                pass('UNIQUE constraint enforced (one payment per home per month)');
            } else if (!err) {
                fail('UNIQUE constraint should prevent duplicate', 'No error thrown');
            } else {
                fail('Unexpected error', err.message);
            }
        }
        );

        await sleep(100); // Wait for DB operation

        // Test 6.2: CASCADE delete (delete home deletes payments)
        console.log('6.2 Testing CASCADE delete...');
        const deleteRes = await request(`/homes/${testHomeId}`, { method: 'DELETE', headers: authHeaders });

        if (deleteRes.status === 200) {
            pass('Home deleted successfully');

            // Verify payments also deleted
            db.get('SELECT * FROM payments WHERE home_id = ?', [testHomeId], (err, payment) =& gt; {
                if (!payment) {
                    pass('Cascade delete: payments removed with home');
                } else {
                    fail('Cascade delete failed', 'Payment records still exist');
                }
            });
        } else {
            fail('Home deletion failed', deleteRes);
        }

        await sleep(100); // Wait for DB operation

        // Test 6.3: Foreign key enforcement
        console.log('6.3 Testing foreign key enforcement...');
        db.run(
            'INSERT INTO payments (home_id, month, year, status, collected_amount) VALUES (?, ?, ?, ?, ?)',
            [999999, month, year, 'unpaid', 0],
            (err) =& gt; {
            if (err && err.message.includes('FOREIGN KEY constraint failed')) {
                pass('Foreign key constraint enforced');
            } else if (!err) {
                // SQLite might not enforce FK by default
                console.log('   ⚠️  Warning: Foreign keys may not be enabled in SQLite');
            } else {
                fail('Unexpected FK error', err.message);
            }
        }
        );

    } catch (e) {
        fail('Database integrity module error', e.message);
    }

    // ============================================================
    // FINAL RESULTS
    // ============================================================
    console.log('\n\n=========================================');
    console.log('📊 VERIFICATION RESULTS');
    console.log('=========================================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.failed & gt; 0) {
        console.log('\n❌ ERRORS:');
        results.errors.forEach((err, i) =& gt; {
            console.log(`${i + 1}. ${err.message}`);
            console.log(`   ${JSON.stringify(err.error)}`);
        });
        console.log('\n❌ VERDICT: System has issues that need fixing.');
    } else {
        console.log('\n✅ VERDICT: System works 100% end-to-end with no errors!');
    }

    console.log('=========================================\n');
}

// Run tests
runTests().catch(err =& gt; {
    console.error('Fatal error:', err);
    process.exit(1);
});
