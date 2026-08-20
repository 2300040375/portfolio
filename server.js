const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const smtpRequiredKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TO'];
const smtpReady = smtpRequiredKeys.every((key) => Boolean(process.env[key] && String(process.env[key]).trim()));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'portfolio-project')));

if (!smtpReady) {
  console.warn('SMTP configuration is incomplete. Check your .env file before sending messages.');
}

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'Portfolio SMTP server is running.' });
});

app.post('/api/send-email', async (req, res) => {
  try {
    const { fullName, emailAddress, subject, message } = req.body || {};

    if (!fullName || !emailAddress || !subject || !message) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const missing = smtpRequiredKeys.filter((key) => !process.env[key] || !String(process.env[key]).trim());

    if (missing.length) {
      console.error('Missing SMTP config:', missing);
      return res.status(500).json({ message: 'SMTP configuration is missing on the server.' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_TO,
      replyTo: emailAddress,
      subject: `Portfolio Contact: ${subject}`,
      text: `Name: ${fullName}\nEmail: ${emailAddress}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `
        <h3>New Contact Message</h3>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${emailAddress}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'Your message was sent successfully.' });
  } catch (error) {
    console.error('SMTP send error:', error);
    return res.status(500).json({ message: 'Failed to send the message. Please try again later.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'portfolio-project', 'index.html'));
});

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    console.error('Server error:', error);
    process.exit(1);
  });
};

startServer(PORT);
