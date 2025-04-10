const express = require('express');
const router = express.Router();
const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Send verification code
router.post('/send-verification', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }

  try {
    console.log(`[Twilio Backend] Sending verification to: ${phone}`);
    console.log(`[Twilio Backend] TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID}`);
    console.log(`[Twilio Backend] TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN}`);
    console.log(`[Twilio Backend] TWILIO_VERIFY_SERVICE_SID: ${process.env.TWILIO_VERIFY_SERVICE_SID}`);

    // Validate SID before making the request
    if (!process.env.TWILIO_VERIFY_SERVICE_SID || !process.env.TWILIO_VERIFY_SERVICE_SID.startsWith('VA')) {
      throw new Error('Invalid or missing TWILIO_VERIFY_SERVICE_SID');
    }

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phone, channel: 'sms' });
    console.log(`[Twilio Backend] Verification SID: ${verification.sid}`);
    res.json({ 
      success: true, 
      verificationId: verification.sid, 
      expiresAt: Date.now() + 10 * 60 * 1000
    });
  } catch (error) {
    console.error('[Twilio Backend] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify code
router.post('/verify-code', async (req, res) => {
  const { verificationId, code } = req.body;
  if (!verificationId || !code) {
    return res.status(400).json({ success: false, error: 'Verification ID and code are required' });
  }

  try {
    console.log(`[Twilio Backend] Verifying code for SID: ${verificationId}`);
    console.log(`[Twilio Backend] TWILIO_VERIFY_SERVICE_SID: ${process.env.TWILIO_VERIFY_SERVICE_SID}`);

    // Validate SID before making the request
    if (!process.env.TWILIO_VERIFY_SERVICE_SID || !process.env.TWILIO_VERIFY_SERVICE_SID.startsWith('VA')) {
      throw new Error('Invalid or missing TWILIO_VERIFY_SERVICE_SID');
    }

    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ verificationSid: verificationId, code });
    console.log(`[Twilio Backend] Verification status: ${check.status}`);
    res.json({ success: check.status === 'approved' });
  } catch (error) {
    console.error('[Twilio Backend] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;