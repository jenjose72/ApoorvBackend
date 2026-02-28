import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import { sendOrderConfirmationEmail, verifyEmailConfig } from './src/utils/email.service.js';

console.log('🔍 Testing Email Configuration...\n');

// First verify the email config
console.log('Step 1: Verifying email service...');
const isConfigValid = await verifyEmailConfig();

if (!isConfigValid) {
    console.log('\n❌ Email configuration failed!');
    console.log('\nPlease check:');
    console.log('1. EMAIL_USER is set in .env');
    console.log('2. EMAIL_PASSWORD is set in .env (use App Password, not regular password)');
    console.log('3. 2FA is enabled on your Gmail account');
    console.log('\nSee EMAIL_SETUP.md for detailed instructions.');
    process.exit(1);
}

console.log('✅ Email service configured correctly!\n');

// Send a test email
console.log('Step 2: Sending test email...');
try {
    const testOrder = {
        email: process.env.EMAIL_USER, // Send test email to yourself
        fullName: 'Test User',
        orderNumber: 'APRV26TEST001',
        items: [
            { product_name: 'Deadpool', variant_size: 'M', quantity: 1 },
            { product_name: 'Spiderman', variant_size: 'L', quantity: 2 }
        ],
        totalAmount: 1047
    };

    const result = await sendOrderConfirmationEmail(testOrder);
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`\nCheck your inbox: ${process.env.EMAIL_USER}`);
    console.log('(Also check spam folder if you don\'t see it)\n');
} catch (error) {
    console.log('\n❌ Failed to send test email!');
    console.log('Error:', error.message);
    console.log('\nPlease verify your Gmail App Password is correct.');
    process.exit(1);
}

console.log('✅ All tests passed! Email service is ready.\n');
process.exit(0);
