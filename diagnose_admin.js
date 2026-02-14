const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const checkAdmin = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const admin = await User.findOne({ username: 'admin' });
        if (admin) {
            console.log('✅ Admin user FOUND.');
            const isMatch = await bcrypt.compare('admin123', admin.password);
            if (isMatch) {
                console.log('✅ Password matches "admin123".');
            } else {
                console.log('❌ Password DOES NOT match "admin123". Resetting...');
                const hashedPassword = await bcrypt.hash('admin123', 10);
                admin.password = hashedPassword;
                await admin.save();
                console.log('✅ Password has been reset to "admin123". Try logging in now.');
            }
        } else {
            console.log('❌ Admin user NOT FOUND. Creating...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({ username: 'admin', password: hashedPassword });
            console.log('✅ Admin user created successfully. Try logging in now.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

checkAdmin();
