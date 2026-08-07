export default async function handler(req, res) {
  // CORS Headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, guestName, eventName, ticketId } = req.body;

    if (!phone || !guestName || !ticketId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Add your SMS Provider (e.g. Twilio, MessageBird) integration here.
    // Example using Twilio:
    // const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    // const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    // const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
    // const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    
    // await client.messages.create({
    //   body: `Hi ${guestName}, here is your invitation for ${eventName}. Ticket ID: ${ticketId}. Please present this at the entrance.`,
    //   from: TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    console.log(`[SMS Gateway] Pretending to send SMS to ${phone} for ${guestName}`);
    
    return res.status(200).json({ success: true, message: 'SMS sent successfully (Simulated)' });
  } catch (error) {
    console.error('SMS API Error:', error);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
}
