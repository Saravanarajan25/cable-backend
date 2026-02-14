require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const authRoutes = require('./routes/auth');
const homesRoutes = require('./routes/homes');
const paymentsRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const { startBillingService } = require('./services/billingService');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Log environment configuration
console.log('[Server] Environment Configuration:');
console.log(`  PORT: ${PORT}`);
console.log(`  FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '***SET***' : '***NOT SET***'}`);

// Connect to MongoDB
connectDB();

// CORS Configuration
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174"
];

app.use(cors({
    origin: function (origin, callback) {
        // allow server-to-server or curl requests
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("[CORS] Blocked request from origin:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Request logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// Basic health routes
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'CablePay Backend Server is running' });
});

app.get('/api', (req, res) => {
    res.json({
        status: 'OK',
        message: 'CablePay API is available',
        endpoints: [
            '/api/auth',
            '/api/homes',
            '/api/payments',
            '/api/dashboard',
            '/api/export'
        ]
    });
});

// Routes
app.use('/api', authRoutes); // This enables /api/login
app.use('/api/homes', homesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'CablePay Backend is healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
// Start server
app.listen(PORT, async () => {
    // Ensure Admin User Exists
    try {
        const bcrypt = require('bcryptjs');
        const User = require('./models/User');
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({ username: 'admin', password: hashedPassword });
            console.log('✅ Admin user created (auto-setup)');
        }
    } catch (err) {
        console.error('❌ Failed to check/create admin user:', err);
    }

    startBillingService();
    console.log(`\n🚀 CablePay Backend Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`\n✅ Ready to accept requests\n`);
});
