const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { pool, query } = require('./db');

const seedData = async () => {
    // Initialize schema first
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await query(schema);
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('Failed to initialize database:', err);
        throw err;
    }

    console.log('\n🌱 Seeding database...\n');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    try {
        await query(
            'INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            ['admin', hashedPassword]
        );
        console.log('✅ Admin user created (username: admin, password: admin123)');
    } catch (err) {
        console.error('Error creating admin user:', err);
    }

    // Sample homes data
    const homes = [
        { home_id: 101, customer_name: 'Rajesh Kumar', phone: '9876543210', set_top_box_id: 'STB-101', monthly_amount: 200 },
        { home_id: 102, customer_name: 'Priya Sharma', phone: '9876543211', set_top_box_id: 'STB-102', monthly_amount: 250 },
        { home_id: 103, customer_name: 'Amit Patel', phone: '9876543212', set_top_box_id: 'STB-103', monthly_amount: 200 },
        { home_id: 104, customer_name: 'Sneha Reddy', phone: '9876543213', set_top_box_id: 'STB-104', monthly_amount: 300 },
        { home_id: 105, customer_name: 'Vikram Singh', phone: '9876543214', set_top_box_id: 'STB-105', monthly_amount: 200 },
        { home_id: 106, customer_name: 'Anita Desai', phone: '9876543215', set_top_box_id: 'STB-106', monthly_amount: 250 },
        { home_id: 107, customer_name: 'Suresh Nair', phone: '9876543216', set_top_box_id: 'STB-107', monthly_amount: 200 },
        { home_id: 108, customer_name: 'Kavita Joshi', phone: '9876543217', set_top_box_id: 'STB-108', monthly_amount: 300 },
        { home_id: 109, customer_name: 'Ravi Verma', phone: '9876543218', set_top_box_id: 'STB-109', monthly_amount: 200 },
        { home_id: 110, customer_name: 'Meera Iyer', phone: '9876543219', set_top_box_id: 'STB-110', monthly_amount: 250 },
        { home_id: 111, customer_name: 'Karthik Rao', phone: '9876543220', set_top_box_id: 'STB-111', monthly_amount: 200 },
        { home_id: 112, customer_name: 'Deepa Menon', phone: '9876543221', set_top_box_id: 'STB-112', monthly_amount: 300 },
        { home_id: 113, customer_name: 'Arjun Kapoor', phone: '9876543222', set_top_box_id: 'STB-113', monthly_amount: 200 },
        { home_id: 114, customer_name: 'Pooja Gupta', phone: '9876543223', set_top_box_id: 'STB-114', monthly_amount: 250 },
        { home_id: 115, customer_name: 'Manoj Pillai', phone: '9876543224', set_top_box_id: 'STB-115', monthly_amount: 200 }
    ];

    // Insert homes
    for (const home of homes) {
        try {
            await query(
                'INSERT INTO homes (home_id, customer_name, phone, set_top_box_id, monthly_amount) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (home_id) DO NOTHING',
                [home.home_id, home.customer_name, home.phone, home.set_top_box_id, home.monthly_amount]
            );
        } catch (err) {
            console.error(`Error inserting home ${home.home_id}:`, err);
        }
    }

    console.log(`✅ Created ${homes.length} sample homes`);

    // Create some sample payments for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Mark some homes as paid (about 60% paid)
    const paidHomes = [101, 102, 104, 105, 107, 108, 110, 112, 114];

    for (const home_id of paidHomes) {
        try {
            const home = homes.find(h => h.home_id === home_id);
            const paidDate = new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 28) + 1).toISOString();
            await query(
                'INSERT INTO payments (home_id, month, year, status, paid_date, collected_amount) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (home_id, month, year) DO NOTHING',
                [home_id, currentMonth, currentYear, 'paid', paidDate, home.monthly_amount]
            );
        } catch (err) {
            console.error(`Error inserting payment for home ${home_id}:`, err);
        }
    }

    console.log(`✅ Created ${paidHomes.length} paid payments for current month`);

    console.log('\n✨ Database seeding completed!\n');
    console.log('📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123\n');

    await pool.end();
    process.exit(0);
};

seedData().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
