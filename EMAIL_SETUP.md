# Email Service Setup Guide

## Gmail Configuration for Order Confirmation Emails

### Step 1: Enable 2-Factor Authentication on Gmail
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password
1. After enabling 2FA, go back to Security settings
2. Find **2-Step Verification** section
3. Scroll down and click on **App passwords**
4. Select **Mail** as the app
5. Select **Other (Custom name)** as the device
6. Enter "APOORV Backend" as the name
7. Click **Generate**
8. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

### Step 3: Update .env File
Open `/ApoorvBackend/.env` and update these two lines:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

Replace:
- `your-email@gmail.com` with your actual Gmail address
- `abcdefghijklmnop` with the 16-character App Password (remove spaces)

### Step 4: Restart Backend Server
```bash
cd "/home/jen/Desktop/Projects/Apoorv Backend/ApoorvBackend"
npm start
```

## How It Works

When an admin clicks **Verify** button on an order:
1. ✅ Order status changes to "verified" in database
2. ✅ Audit log is created
3. 📧 **Email is automatically sent to customer** with:
   - Order confirmation
   - Order number
   - List of items with sizes
   - Total amount
   - Collection instructions

## Email Template Preview

**Subject:** Order Confirmed - APRV2610001 | APOORV 2026

**Content:**
- Professional HTML email with APOORV branding
- Order details with item list
- Collection instructions
- Beautifully formatted with colors matching APOORV theme

## Testing

1. Place a test order with a real email address
2. Login to admin dashboard
3. Click **Verify** on the order
4. Check the email inbox (and spam folder just in case)

## Troubleshooting

**Email not sending?**
- Check that EMAIL_USER and EMAIL_PASSWORD are correct in .env
- Verify 2FA is enabled on Gmail
- Make sure App Password is generated (not regular Gmail password)
- Check backend console for error messages
- Try with a different Gmail account

**Email going to spam?**
- This is normal for new email configurations
- Ask recipients to mark as "Not Spam"
- After verification, emails should go to inbox

## Important Notes

⚠️ **Never commit .env file to Git** - it contains sensitive credentials
⚠️ **App Password is NOT your Gmail password** - it's a special 16-character code
⚠️ Email sending is non-blocking - order verification succeeds even if email fails
⚠️ Check backend logs to see email sending status

## Security

✅ App Password is safer than using real Gmail password
✅ Can be revoked anytime from Google Account settings
✅ Limited to email sending only (no other account access)
