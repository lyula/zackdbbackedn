const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

// POST /api/send-bulk-email
router.post('/send-bulk-email', async (req, res) => {
  const { connectionString, dbName, collectionName, from, subject, body } = req.body;

  if (!connectionString || !dbName || !collectionName || !from || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  let client;
  try {
    client = await MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Find all documents with an email field
    const docs = await collection.find({ email: { $exists: true, $ne: '' } }).toArray();
    const emails = docs.map(doc => doc.email).filter(Boolean);

    if (!emails.length) {
      return res.status(404).json({ error: 'No emails found in this collection.' });
    }

    // Configure your SMTP transporter (update with your SMTP credentials)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send email to all addresses (as BCC)
    await transporter.sendMail({
      from,
      to: from,
      bcc: emails,
      subject,
      text: body,
      html: `<div>${body}</div>`,
    });

    res.json({ success: true, sent: emails.length });
  } catch (err) {
    console.error('Bulk email error:', err);
    res.status(500).json({ error: 'Failed to send emails.' });
  } finally {
    if (client) await client.close();
  }
});

module.exports = router;