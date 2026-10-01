const nodemailer = require('nodemailer');
require('dotenv').config();

const SUPPORT_EMAIL = 'support@apexingoodcompany.co.uk';

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send winner notification email
const sendWinnerEmail = async (email, name, competitionName, prize) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || SUPPORT_EMAIL,
      to: email,
      subject: `🏆 Congratulations! You've Won: ${competitionName}`,
      html: `
        <h1 style="color: #ff8c00;">🏆 Congratulations, ${name}!</h1>
        <p>You have been randomly selected as the winner of the <strong>${competitionName}</strong> competition!</p>
        <p><strong>Your Prize:</strong> ${prize}</p>
        <p>Our team will contact you shortly to arrange prize delivery.</p>
        <p style="color: #666; margin-top: 20px;">
          Best regards,<br>
          <strong>Apex Moto Competitions</strong>
        </p>
      `
    });
    console.log(`Winner email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending winner email:', error);
    return false;
  }
};

// Send order confirmation email
const sendOrderEmail = async (email, name, orderId, amount, orderType) => {
  try {
    const typeLabel = orderType === 'competition' ? 'Competition Entry' : 'Store Order';
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || SUPPORT_EMAIL,
      to: email,
      subject: `Order Confirmation #${orderId} - Apex Moto Competitions`,
      html: `
        <h1>Order Confirmation</h1>
        <p>Thank you for your order, ${name}!</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Type:</strong> ${typeLabel}</p>
        <p><strong>Amount:</strong> £${amount.toFixed(2)}</p>
        <p>You can track your order status in your account dashboard.</p>
        <p style="color: #666; margin-top: 20px;">
          Thank you for choosing Apex Moto Competitions!
        </p>
      `
    });
    console.log(`Order email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending order email:', error);
    return false;
  }
};

module.exports = {
  sendWinnerEmail,
  sendOrderEmail,
  transporter
};
