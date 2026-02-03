/**
 * JWT Token Test Script
 * Tests token generation and verification with current JWT_SECRET
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('========================================');
console.log('JWT TOKEN TEST');
console.log('========================================\n');

// Check if JWT_SECRET is loaded
console.log('1. Environment Check:');
console.log('   JWT_SECRET loaded:', !!process.env.JWT_SECRET);
console.log('   JWT_SECRET value:', process.env.JWT_SECRET);
console.log('');

// Generate a test token
console.log('2. Generating test token...');
const testPayload = { id: 1, username: 'admin' };
const testToken = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
console.log('   Token generated:', testToken.substring(0, 50) + '...');
console.log('');

// Verify the token
console.log('3. Verifying test token...');
try {
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
    console.log('   ✅ Token verified successfully!');
    console.log('   Decoded payload:', decoded);
} catch (error) {
    console.log('   ❌ Token verification failed!');
    console.log('   Error:', error.message);
}
console.log('');

// Test with a sample token from frontend (if provided)
console.log('4. To test a frontend token:');
console.log('   - Copy token from browser localStorage');
console.log('   - Run: node test_jwt.js <token>');
console.log('');

if (process.argv[2]) {
    console.log('5. Testing provided token...');
    const providedToken = process.argv[2];
    try {
        const decoded = jwt.verify(providedToken, process.env.JWT_SECRET);
        console.log('   ✅ Provided token is VALID!');
        console.log('   Decoded payload:', decoded);
    } catch (error) {
        console.log('   ❌ Provided token is INVALID!');
        console.log('   Error:', error.message);
        console.log('   Error type:', error.name);

        if (error.name === 'TokenExpiredError') {
            console.log('   → Token has expired. User needs to login again.');
        } else if (error.name === 'JsonWebTokenError') {
            console.log('   → Token is malformed or signed with different secret.');
            console.log('   → This means JWT_SECRET mismatch between login and verification!');
        }
    }
}

console.log('========================================');
