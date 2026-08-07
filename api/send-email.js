import { Resend } from 'resend';

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
    const { email, guestName, eventName, ticketId, qrDataUrl } = req.body;

    if (!email || !guestName || !ticketId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Resend with the provided key (or from env var for security on Vercel)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY environment variable.");
    }
    const resend = new Resend(RESEND_API_KEY);

    // Send the email
    const data = await resend.emails.send({
      from: 'tickets@resend.dev', // Use resend.dev for testing unless you have a verified domain
      to: email,
      subject: `Your Ticket for ${eventName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${guestName},</h2>
          <p>Here is your official invitation for <strong>${eventName}</strong>.</p>
          <p>Please present the attached QR code ticket at the entrance.</p>
          <p style="color: #666; font-size: 0.9em;">Ticket ID: ${ticketId}</p>
        </div>
      `,
      attachments: [
         { 
           filename: `${guestName.replace(/\s+/g, '_')}_Ticket.png`, 
           content: qrDataUrl.split(',')[1] // Extract base64 part
         }
      ]
    });

    console.log(`[Email Gateway] Successfully sent email to ${email} for ${guestName}`);
    
    return res.status(200).json({ success: true, message: 'Email sent successfully', data });
  } catch (error) {
    console.error('Email API Error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
