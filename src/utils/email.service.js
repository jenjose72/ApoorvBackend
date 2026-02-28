import nodemailer from 'nodemailer';

/**
 * Email service for sending order confirmation emails
 * Uses Gmail SMTP
 */

let transporter = null;

// Create transporter lazily (when first needed)
function getTransporter() {
    if (transporter) return transporter;

    // Get credentials and trim any whitespace
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPassword = process.env.EMAIL_PASSWORD?.trim();

    // Validate credentials
    if (!emailUser || !emailPassword) {
        throw new Error('Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env file');
    }

    // Create transporter with Gmail
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use TLS
        auth: {
            user: emailUser,
            pass: emailPassword
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    return transporter;
}

/**
 * Send order confirmation email when admin verifies order
 * @param {Object} orderDetails - Order information
 * @param {string} orderDetails.email - Customer email
 * @param {string} orderDetails.fullName - Customer name
 * @param {string} orderDetails.orderNumber - Order number (e.g., APRV2610001)
 * @param {string} orderDetails.collectionCode - 6-character pickup code (e.g., ABC123)
 * @param {Array} orderDetails.items - Array of order items
 * @param {number} orderDetails.totalAmount - Total order amount
 */
export async function sendOrderConfirmationEmail(orderDetails) {
    const { email, fullName, orderNumber, collectionCode, items, totalAmount } = orderDetails;
    const transporter = getTransporter();

    // Format items list for email
    const itemsList = items.map(item => 
        `  • ${item.product_name} (${item.variant_size}) × ${item.quantity}`
    ).join('\n');

    const mailOptions = {
        from: `"APOORV 2026" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Order Confirmed - ${orderNumber} | APOORV 2026`,
        text: `
Hi ${fullName},

Great news! Your order has been confirmed by our team.

Order Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order Number: ${orderNumber}
Status: CONFIRMED ✓

Items Ordered:
${itemsList}

Total Amount: ₹${totalAmount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎫 YOUR COLLECTION CODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        ${collectionCode}

Present this code at the merchandise counter!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Collection Details:
• Collection Code: ${collectionCode}
• Order Number: ${orderNumber}
• Venue: APOORV 2026 Festival Grounds
• Collection Counter: Official Merchandise Stall

Your merch will be available for collection at the APOORV 2026 merchandise counter during the festival.

If you have any questions, feel free to contact us.

See you at APOORV 2026! 🎉

Best regards,
APOORV 2026 Team
        `.trim(),
        html: `
<!DOCTYPE html>
<html>
<head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Syne', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #000000;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .email-wrapper {
            background: #000000;
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 600px;
            margin: 0 auto;
            background: #0a0a0a;
            border: 1px solid rgba(204, 86, 30, 0.2);
            border-radius: 12px;
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #FF6500 0%, #CC561E 50%, #F6CE71 100%);
            padding: 40px 30px;
            text-align: center;
            border-bottom: 2px solid #F6CE71;
        }
        .header h1 { 
            font-family: 'Anton', sans-serif;
            font-size: 42px;
            font-weight: 400;
            letter-spacing: 2px;
            color: #000000;
            text-transform: uppercase;
            margin: 0 0 10px 0;
            text-shadow: 2px 2px 0px rgba(0,0,0,0.1);
        }
        .status-badge { 
            background: rgba(0, 0, 0, 0.3);
            display: inline-block;
            padding: 8px 24px;
            border-radius: 20px;
            font-family: 'Syne', sans-serif;
            font-size: 13px;
            font-weight: 700;
            color: #F6CE71;
            letter-spacing: 2px;
            text-transform: uppercase;
            border: 1px solid rgba(246, 206, 113, 0.3);
        }
        .content { 
            padding: 40px 30px;
            background: #0a0a0a;
        }
        .greeting { 
            font-family: 'Syne', sans-serif;
            font-size: 18px;
            font-weight: 600;
            color: #F6CE71;
            margin-bottom: 20px;
        }
        .greeting strong {
            color: #FF6500;
        }
        .intro-text {
            font-family: 'Syne', sans-serif;
            color: rgba(246, 206, 113, 0.7);
            font-size: 15px;
            margin-bottom: 30px;
            line-height: 1.7;
        }
        .order-box { 
            background: rgba(255, 101, 0, 0.05);
            border: 1px solid rgba(246, 206, 113, 0.2);
            border-left: 4px solid #FF6500;
            padding: 25px;
            margin: 25px 0;
            border-radius: 8px;
        }
        .order-number { 
            font-family: 'Anton', sans-serif;
            font-size: 28px;
            font-weight: 400;
            letter-spacing: 1px;
            color: #F6CE71;
            margin-bottom: 8px;
        }
        .confirmed-badge {
            display: inline-block;
            background: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
            padding: 6px 16px;
            border-radius: 16px;
            font-family: 'Syne', sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 20px;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .section-title {
            font-family: 'Syne', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #CC561E;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
        }
        .items-list { 
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .items-list li { 
            padding: 12px 0;
            border-bottom: 1px solid rgba(246, 206, 113, 0.1);
            color: rgba(246, 206, 113, 0.9);
            font-family: 'Syne', sans-serif;
            font-size: 14px;
        }
        .items-list li:last-child { 
            border-bottom: none;
        }
        .items-list strong {
            color: #F6CE71;
            font-weight: 600;
        }
        .total { 
            font-family: 'Anton', sans-serif;
            font-size: 26px;
            font-weight: 400;
            color: #FF6500;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid rgba(255, 101, 0, 0.3);
            letter-spacing: 1px;
        }
        .collection-info { 
            background: rgba(246, 206, 113, 0.05);
            border: 1px solid rgba(246, 206, 113, 0.2);
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .collection-info h3 { 
            font-family: 'Anton', sans-serif;
            font-size: 20px;
            font-weight: 400;
            color: #F6CE71;
            margin: 0 0 15px 0;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .collection-info ul {
            margin: 0;
            padding-left: 20px;
            color: rgba(246, 206, 113, 0.7);
            font-family: 'Syne', sans-serif;
            font-size: 14px;
            line-height: 1.8;
        }
        .collection-info li {
            margin: 8px 0;
        }
        .collection-info strong {
            color: #FF6500;
            font-weight: 600;
        }
        .closing-text {
            font-family: 'Syne', sans-serif;
            color: rgba(246, 206, 113, 0.6);
            font-size: 14px;
            margin-top: 30px;
            line-height: 1.7;
        }
        .cta-text {
            font-family: 'Anton', sans-serif;
            font-size: 24px;
            font-weight: 400;
            color: #FF6500;
            margin-top: 20px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .collection-code-box {
            background: #000000;
            border: 3px solid #F6CE71;
            border-radius: 12px;
            padding: 30px 20px;
            text-align: center;
            margin: 30px 0;
            box-shadow: 0 0 20px rgba(246, 206, 113, 0.2);
        }
        .collection-code-label {
            font-family: 'Syne', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #CC561E;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 15px;
        }
        .collection-code {
            font-family: 'Anton', sans-serif;
            font-size: 56px;
            font-weight: 400;
            color: #F6CE71;
            letter-spacing: 8px;
            margin: 10px 0;
            text-shadow: 0 0 10px rgba(246, 206, 113, 0.3);
        }
        .collection-code-instructions {
            font-family: 'Syne', sans-serif;
            font-size: 13px;
            color: rgba(246, 206, 113, 0.6);
            margin-top: 15px;
            line-height: 1.6;
        }
        .footer { 
            background: #000000;
            border-top: 1px solid rgba(204, 86, 30, 0.3);
            padding: 30px;
            text-align: center;
        }
        .footer-text {
            font-family: 'Syne', sans-serif;
            color: rgba(246, 206, 113, 0.5);
            font-size: 13px;
            line-height: 1.8;
        }
        .footer a { 
            color: #F6CE71;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.3s ease;
        }
        .footer a:hover {
            color: #FF6500;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(246, 206, 113, 0.2), transparent);
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <h1>ORDER CONFIRMED</h1>
                <div class="status-badge">APOORV 2026</div>
            </div>
            
            <div class="content">
                <div class="greeting">Hi <strong>${fullName}</strong>,</div>
                <p class="intro-text">Great news! Your order has been confirmed by our team. Get ready to rock the festival in style! 🎉</p>
                
                <div class="order-box">
                    <div class="order-number">ORDER #${orderNumber}</div>
                    <div class="confirmed-badge">✓ CONFIRMED</div>
                    
                    <div class="divider"></div>
                    
                    <div class="section-title">Items Ordered</div>
                    <ul class="items-list">
                        ${items.map(item => 
                            `<li><strong>${item.product_name}</strong> <span style="color: rgba(246, 206, 113, 0.5);">(${item.variant_size})</span> × ${item.quantity}</li>`
                        ).join('')}
                    </ul>
                    
                    <div class="total">Total: ₹${totalAmount}</div>
                </div>
                
                <div class="collection-code-box">
                    <div class="collection-code-label">🎫 Your Collection Code</div>
                    <div class="collection-code">${collectionCode}</div>
                    <div class="collection-code-instructions">
                        Present this code at the merchandise counter<br>
                        along with your order number to collect your items
                    </div>
                </div>
                
                <div class="collection-info">
                    <h3>📦 Collection Details</h3>
                    <ul>
                        <li>Collection Code: <strong>${collectionCode}</strong></li>
                        <li>Order Number: <strong>${orderNumber}</strong></li>
                        <li>Venue: <strong>APOORV 2026 Festival Grounds</strong></li>
                        <li>Collection Counter: <strong>Official Merchandise Stall</strong></li>
                    </ul>
                </div>
                
                <p class="closing-text">If you have any questions about your order, feel free to reach out to us. We're here to help!</p>
                <div class="cta-text">See you at APOORV 2026! 🚀</div>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    <strong style="color: #F6CE71;">APOORV 2026 TEAM</strong><br>
                    <a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✓ Order confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('✗ Failed to send order confirmation email:', error);
        throw error;
    }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig() {
    try {
        const transporter = getTransporter();
        await transporter.verify();
        console.log('✓ Email service is ready');
        return true;
    } catch (error) {
        console.error('✗ Email service configuration error:', error.message);
        return false;
    }
}
