const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to Database
const dbPath = path.resolve('c:\\Users\\SARAVANARAJAN\\Desktop\\backnd\\database\\cablepay.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

const searchTerm = "Type Check";
// Also try to parse "102-B" -> maybe home_id 102?
const searchId = 102;

db.serialize(() => {
    console.log(`Searching for customer_name LIKE '%${searchTerm}%' OR home_id = ${searchId}...`);

    db.all(`SELECT * FROM homes WHERE customer_name LIKE ? OR home_id = ?`, [`%${searchTerm}%`, searchId], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }
        if (rows.length === 0) {
            console.log("No matching home found.");
        } else {
            console.log("Found homes:", JSON.stringify(rows, null, 2));
        }
    });
});

db.close();
