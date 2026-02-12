const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to Database
const dbPath = path.resolve('c:\\Users\\SARAVANARAJAN\\Desktop\\backnd\\database\\cablepay.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("--- Schema Info ---");
    db.all("PRAGMA table_info(homes)", (err, rows) => {
        if (err) console.log(err);
        else console.table(rows);
    });

    console.log("\n--- Search for 'Type Check' ---");
    db.all(`SELECT * FROM homes WHERE customer_name LIKE '%Type Check%'`, (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));
    });

    console.log("\n--- Search for '102-B' in all columns ---");
    db.all(`SELECT * FROM homes WHERE 
        home_id LIKE '%102-B%' OR 
        customer_name LIKE '%102-B%' OR 
        phone LIKE '%102-B%' OR 
        set_top_box_id LIKE '%102-B%'
    `, (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));
    });

    // Check what ID 102 actually was/is if it was re-created or what exists now
    console.log("\n--- Check ID 102 ---");
    db.all("SELECT * FROM homes WHERE home_id = 102", (err, rows) => {
        if (err) console.error(err);
        else console.log("ID 102:", JSON.stringify(rows, null, 2));
    });

});

// db.close(); // Keep open for async above? No serialize handles it. Close at end of serialize?
// Actually safe to close in callback or just let script exit.
// explicit close:
// db.close(); 
