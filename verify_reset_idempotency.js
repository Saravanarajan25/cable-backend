const { initMonthlyReset } = require('./services/billingService');
const { db } = require('./database');

async function testIdempotency() {
    console.log('🚀 Starting Monthly Reset Idempotency Check...');

    try {
        // Run 1
        console.log('1. Running Reset (Iteration 1)...');
        const changes1 = await initMonthlyReset();
        console.log(`   Changes: ${changes1}`);

        // Run 2
        console.log('2. Running Reset (Iteration 2)...');
        const changes2 = await initMonthlyReset();
        console.log(`   Changes: ${changes2}`);

        if (changes2 === 0) {
            console.log('   ✅ Idempotency Verified: No duplicate records created on second run.');
        } else {
            console.error(`   ❌ Failure: Second run created ${changes2} records! Logic is not idempotent.`);
            process.exit(1);
        }
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

testIdempotency();
