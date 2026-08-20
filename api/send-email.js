const nodemailer = require('nodemailer');

const requiredKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

async function getRequestBody(req) {
  if (req.body) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const text = Buffer.concat(chunks).toString();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function normalizeBody(body = {}) {
  return {
    fullName: String(body.fullName || '').trim(),
    emailAddress: String(body.emailAddress || '').trim(),
    subject: String(body.subject || '').trim(),
    message: String(body.message || '').trim(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const body = normalizeBody(await getRequestBody(req));

  if (!body.fullName || !body.emailAddress || !body.subject || !body.message) {
    res.status(400).json({ message: 'Please fill in all required fields.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.emailAddress)) {
    res.status(400).json({ message: 'Please enter a valid email address.' });
    return;
  }

  const missing = requiredKeys.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length) {
    console.error('Missing SMTP config:', missing);
    res.status(500).json({ message: `SMTP configuration is missing: ${missing.join(', ')}.` });
    return;
  }

  const senderAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const recipientAddress = process.env.SMTP_TO || process.env.SMTP_USER;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: senderAddress,
      to: recipientAddress,
      replyTo: body.emailAddress,
      subject: `Portfolio Contact: ${body.subject}`,
      text: `Name: ${body.fullName}\nEmail: ${body.emailAddress}\nSubject: ${body.subject}\n\nMessage:\n${body.message}`,
      html: `
        <h3>New Contact Message</h3>
        <p><strong>Name:</strong> ${body.fullName}</p>
        <p><strong>Email:</strong> ${body.emailAddress}</p>
        <p><strong>Subject:</strong> ${body.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${body.message.replace(/\n/g, '<br>')}</p>
      `,
    });

    res.status(200).json({ message: 'Your message was sent successfully.' });
  } catch (error) {
    console.error('SMTP send error:', error);
    res.status(500).json({ message: 'Failed to send the message. Please try again later.' });
  }
};
