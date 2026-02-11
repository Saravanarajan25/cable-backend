const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/export/excel?month=2&year=2026&status=all',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer ' + 'YOUR_TOKEN_HERE_IF_NEEDED' // We might need a token
    }
};

// We need a token. Let's login first.
function login() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Login Response:', data);
                try {
                    const json = JSON.parse(data);
                    if (json.token) resolve(json.token);
                    else reject('No token in response: ' + data);
                } catch (e) {
                    reject('Invalid JSON: ' + data);
                }
            });
        });
        req.write(JSON.stringify({ username: 'admin', password: 'admin123' }));
        req.end();
    });
}

async function checkExport() {
    try {
        console.log('Logging in...');
        const token = await login();
        console.log('Got token.');

        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/export/excel?month=2&year=2026&status=all',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', res.headers);

            const contentDisposition = res.headers['content-disposition'];
            const contentType = res.headers['content-type'];

            if (res.statusCode === 200 &&
                contentDisposition &&
                contentDisposition.includes('attachment') &&
                contentType.includes('spreadsheet')) {
                console.log('\n✅ PASS: Export Headers are correct!');
                console.log('   - Content-Disposition:', contentDisposition);
            } else {
                console.log('\n❌ FAIL: Headers missing or incorrect.');
            }
        });
        req.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkExport();
