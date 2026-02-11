const http = require('http');

const BASE_URL = 'http://localhost:3001/api';
let AUTH_TOKEN = '';

function makeRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data); // In case it's not JSON
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function login() {
    const data = await makeRequest(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));
    return data.token;
}

async function run() {
    try {
        console.log('Logging in...');
        AUTH_TOKEN = await login();

        const d = new Date();
        const month = d.getMonth() + 1; // Current month
        const year = d.getFullYear();
        const HOME_ID = 101;

        console.log(`Testing with Home ${HOME_ID} for ${month}/${year}`);

        // 1. Mark Home 101 as PAID
        console.log('Marking home as PAID...');
        await makeRequest(`${BASE_URL}/payments/mark-paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` }
        }, JSON.stringify({ home_id: HOME_ID, month, year }));

        // 2. Fetch Unpaid List
        console.log('Fetching Unpaid List...');
        const unpaidList = await makeRequest(`${BASE_URL}/payments?month=${month}&year=${year}&status=unpaid`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });

        if (!Array.isArray(unpaidList)) {
            console.error('Error: Unpaid list response is not an array:', unpaidList);
            return;
        }

        // 3. Check if Home 101 is in the list
        const found = unpaidList.find(h => h.home_id === HOME_ID);

        if (found) {
            console.log('FAIL: Paid home WAS found in Unpaid list. Logic is still broken or DB not responding as expected.');
            console.log('Home details from list:', found);
        } else {
            console.log('PASS: Paid home was NOT found in Unpaid list. Fix verified!');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
