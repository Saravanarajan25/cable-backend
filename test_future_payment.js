// using global fetch
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:3001/api';
let AUTH_TOKEN = '';

async function login() {
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        const data = await res.json();
        if (data.token) {
            AUTH_TOKEN = data.token;
            console.log('Login successful');
        } else {
            console.error('Login failed:', data);
            process.exit(1);
        }
    } catch (e) {
        console.error('Login error (server running?):', e.message);
        process.exit(1);
    }
}

async function getDashboardStats() {
    const res = await fetch(`${BASE_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    return res.json();
}

async function markPaid(homeId, month, year) {
    const res = await fetch(`${BASE_URL}/payments/mark-paid`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ home_id: homeId, month, year })
    });
    return res.json();
}

async function checkExcel(year, homeId, month, expectedDateSubstr) {
    // Request asking for month 12 to ensure we get a wide range if logic depends on it, 
    // though our logic now ignores reporting limit for paid items.
    const res = await fetch(`${BASE_URL}/export/excel?year=${year}&month=12&status=all`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    if (res.status !== 200) {
        console.error('Failed to download Excel. Status:', res.status);
        return false;
    }

    const buffer = await res.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(buffer));
    const worksheet = workbook.getWorksheet('Payments');

    // Find row for homeId
    let found = false;
    let cellValue = '';

    worksheet.eachRow((row, rowNumber) => {
        // row.values is 1-based array: [empty, col1, col2, ...]
        // Home ID is column 2 (based on export.js columns list)
        // S.No(1), HomeID(2)
        const rowHomeId = row.getCell(2).value;

        if (rowHomeId == homeId) {
            console.log(`Found row for Home ${homeId} at row ${rowNumber}`);

            // Columns: S.No(1), HomeID(2), Name(3), Phone(4), STB(5), Amount(6)
            // Month 1 (Jan) is Col 7
            // Month 9 (Sep) is Col 7 + 8 = 15
            const colIndex = 6 + parseInt(month);

            try {
                cellValue = row.getCell(colIndex).value;
                console.log(`Value at col ${colIndex} (Month ${month}): "${cellValue}"`);
            } catch (e) {
                console.error('Error accessing cell:', e.message);
                cellValue = 'ERROR_ACCESSING_CELL';
            }

            found = true;
        }
    });

    if (!found) {
        console.error(`Home ${homeId} not found in Excel`);
        return false;
    }

    // Check if the expected date is present
    if (String(cellValue).includes(expectedDateSubstr)) {
        return true;
    } else {
        console.error(`Expected Excel to contain "${expectedDateSubstr}" but found "${cellValue}"`);
        return false;
    }
}

async function run() {
    await login();

    const HOME_ID = 101;
    const FUTURE_MONTH = 9; // September
    const YEAR = 2026;

    console.log('--- Step 1: Baseline Dashboard ---');
    const statsBefore = await getDashboardStats();
    console.log('Stats before:', statsBefore);

    console.log('--- Step 2: Pay for September 2026 ---');
    const payment = await markPaid(HOME_ID, FUTURE_MONTH, YEAR);
    console.log('Payment result:', payment);

    console.log('--- Step 3: Verify Dashboard Unchanged ---');
    const statsAfter = await getDashboardStats();
    console.log('Stats after:', statsAfter);

    if (statsBefore.paid !== statsAfter.paid) {
        console.error('FAIL: Dashboard paid count changed!');
    } else {
        console.log('PASS: Dashboard paid count unchanged.');
    }

    console.log('--- Step 4: Verify Excel ---');
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const expectedSubstr = `${day}-${month}-${year}`;
    console.log('Expected Date Substring:', expectedSubstr);

    const excelPass = await checkExcel(YEAR, HOME_ID, FUTURE_MONTH, expectedSubstr);
    if (excelPass) {
        console.log('PASS: Excel contains payment date.');
    } else {
        console.error('FAIL: Excel does NOT contain payment date.');
    }
}

run();
