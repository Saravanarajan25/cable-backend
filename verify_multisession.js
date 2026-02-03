const http = require('http');
const { initMonthlyReset } = require('./services/billingService');
const { db } = require('./database');

const PORT = 3001;
const HOST = 'localhost';

function request(path, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: HOST,
            port: PORT,
            path: '/api' + path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (body) {
            reqOptions.headers['Content-Type'] = 'application/json';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
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

        req.on('error', (e) => reject(e));

        if (body) req.write(body);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚀 Starting Multi-Session & Edge Case Verification...');

    let token1 = '';
    let token2 = '';
    const testHomeId = 99999;

    // --- MODULE 1: AUTHENTICATION (MULTI-SESSION) ---
    console.log('\n--- MODULE 1: Multi-Session Auth ---');
    try {
        console.log('1. Logging in Session A...');
        const res1 = await request('/login', { method: 'POST' }, JSON.stringify({ username: 'admin', password: 'admin123' }));
        if (res1.status !== 200) throw new Error(`Session A Login failed: ${res1.status}`);
        token1 = res1.data.token;
        console.log('   ✅ Session A Token received.');

        console.log('2. Logging in Session B (Simulating different device)...');
        const res2 = await request('/login', { method: 'POST' }, JSON.stringify({ username: 'admin', password: 'admin123' }));
        if (res2.status !== 200) throw new Error(`Session B Login failed: ${res2.status}`);
        token2 = res2.data.token;
        console.log('   ✅ Session B Token received.');

        if (token1 === token2) {
            console.log('   ℹ️  Note: Tokens are identical (expected for stateless JWT with same payload/time), but both defined.');
        } else {
            console.log('   ℹ️  Tokens are different (timestamps differ).');
        }

    } catch (e) {
        console.error('❌ Auth Verification Failed:', e.message);
        process.exit(1);
    }

    const headersA = { 'Authorization': `Bearer ${token1}` };
    const headersB = { 'Authorization': `Bearer ${token2}` };

    // --- MODULE 2: HOME MANAGEMENT & DUPLICATE ID ---
    console.log('\n--- MODULE 2: Home Management & Edge Cases ---');
    try {
        // cleanup first
        await request(`/homes/${testHomeId}`, { method: 'DELETE', headers: headersA });

        console.log(`1. Creating Home #${testHomeId} using Session A...`);
        const newHome = JSON.stringify({
            home_id: testHomeId,
            customer_name: 'MultiUser Test',
            phone: '1111111111',
            set_top_box_id: 'STB-MULTI-01',
            monthly_amount: 600
        });
        const resCreate = await request('/homes', { method: 'POST', headers: headersA }, newHome);
        if (resCreate.status !== 201) throw new Error(`Create Home failed: ${resCreate.status}`);
        console.log('   ✅ Home created with Session A.');

        console.log(`2. Attempting to create DUPLICATE Home #${testHomeId} using Session B...`);
        const resDup = await request('/homes', { method: 'POST', headers: headersB }, newHome);
        if (resDup.status === 400 && resDup.data.error.includes('already exists')) {
            console.log('   ✅ Duplicate creation blocked correctly.');
        } else {
            throw new Error(`Duplicate check failed. Status: ${resDup.status}, Error: ${JSON.stringify(resDup.data)}`);
        }

    } catch (e) {
        console.error('❌ Home Module Failed:', e.message);
    }

    // --- MODULE 3: PAYMENTS & SESSION INTEROP ---
    console.log('\n--- MODULE 3: Payments & Session Interoperability ---');
    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        console.log('1. Marking PAID using Session B...');
        const markBody = JSON.stringify({ home_id: testHomeId, month, year });
        const resPay = await request('/payments/mark-paid', { method: 'POST', headers: headersB }, markBody);

        if (resPay.status !== 200) throw new Error(`Mark Paid failed: ${resPay.status}`);
        if (resPay.data.status !== 'paid') throw new Error('Status not updated to paid');
        console.log('   ✅ Marked Paid by Session B.');

        console.log('2. Verifying Status using Session A...');
        const resCheck = await request(`/homes/${testHomeId}`, { headers: headersA });
        if (resCheck.data.payment_status !== 'paid') throw new Error(`Session A sees status: ${resCheck.data.payment_status}`);
        console.log('   ✅ Session A sees updated status (PAID).');

        console.log('3. Toggling UNPAID using Session A...');
        const resUnpay = await request('/payments/mark-unpaid', { method: 'PUT', headers: headersA }, markBody);
        if (resUnpay.status !== 200) throw new Error(`Mark Unpaid failed: ${resUnpay.status}`);
        console.log('   ✅ Marked Unpaid by Session A.');

    } catch (e) {
        console.error('❌ Payment Module Failed:', e.message);
    }

    // --- MODULE 6: MONTHLY RESET IDEMPOTENCY ---
    console.log('\n--- MODULE 6: Monthly Reset Idempotency ---');
    try {
        console.log('1. Running Monthly Reset (Run 1)...');
        const changes1 = await initMonthlyReset();
        console.log(`   Run 1 Changes: ${changes1}`);

        console.log('2. Running Monthly Reset (Run 2) - Should be 0 changes...');
        const changes2 = await initMonthlyReset();
        console.log(`   Run 2 Changes: ${changes2}`);

        if (changes2 === 0) {
            console.log('   ✅ Idempotency Verified (No duplicate records created).');
        } else {
            console.warn('   ⚠️  Warning: Changes detected on second run. Check logic.');
        }

    } catch (e) {
        console.error('❌ Reset Module Failed:', e.message);
    }

    // --- CLEANUP ---
    console.log('\n--- Cleanup ---');
    try {
        await request(`/homes/${testHomeId}`, { method: 'DELETE', headers: headersA });
        console.log('✅ Test Home Deleted.');
    } catch (e) {
        console.error('Cleanup failed:', e);
    }

    console.log('\n🏁 Full Multi-Session Verification Complete.');
}

runTests();
