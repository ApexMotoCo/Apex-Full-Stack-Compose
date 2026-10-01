const nodemailer = require('nodemailer');

// Email configuration
const SUPPORT_EMAIL = 'support@apexingoodcompany.co.uk';
const BUSINESS_EMAIL = 'Business@apexingoodcompany.co.uk';
const EVENTS_EMAIL = 'events@apexingoodcompany.co.uk';
const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mail.ovh.net',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
        user: process.env.EMAIL_USER || SUPPORT_EMAIL,
        pass: process.env.EMAIL_PASSWORD || ''
    }
});

// Route emails based on department
const emailRouting = {
    'General': BUSINESS_EMAIL,
    'Shop': SUPPORT_EMAIL,
    'Events': EVENTS_EMAIL,
    'Detailing': SUPPORT_EMAIL
};

async function sendContactEmail(name, email, department, subject, message) {
    try {
        const recipientEmail = emailRouting[department] || BUSINESS_EMAIL;
        
        console.log('📧 Preparing email...');
        console.log('   From:', process.env.EMAIL_USER);
        console.log('   To:', recipientEmail);
        console.log('   Reply-To:', email);
        console.log('   Department:', department);
        
        const mailOptions = {
            from: process.env.EMAIL_USER || SUPPORT_EMAIL,
            to: recipientEmail,
            replyTo: email, // IMPORTANT: This is what lets you reply to the customer
            subject: `[${department}] ${subject} - From ${name}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                <p><strong>Department:</strong> ${escapeHtml(department)}</p>
                <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                <hr/>
                <h3>Message:</h3>
                <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
                <hr/>
                <p><small>Click "Reply" to respond directly to ${name}</small></p>
            `
        };
        
        console.log('📨 Sending email via SMTP...');
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${recipientEmail} for ${department}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

async function sendContactConfirmation(email, name, subject) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER || SUPPORT_EMAIL,
            to: email,
            subject: `We received your enquiry - ${subject}`,
            html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks for contacting Apex Moto & Co. We have received your enquiry and will get back to you as soon as possible.</p><p>Regards,<br>Apex Moto & Co.</p>`
        });
        return true;
    } catch (error) {
        console.error('Contact confirmation email error:', error.message);
        return false;
    }
}

module.exports = { sendContactEmail, sendContactConfirmation, emailRouting, transporter };
