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

    // TODO: Add your Email Provider (e.g. Resend, SendGrid, Nodemailer) integration here.
    // Example using Resend:
    // const RESEND_API_KEY = process.env.RESEND_API_KEY;
    // const resend = new Resend(RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'tickets@yourevent.com',
    //   to: email,
    //   subject: `Your Ticket for ${eventName}`,
    //   html: `<p>Hi ${guestName},</p><p>Here is your ticket. ID: ${ticketId}</p>`,
    //   attachments: [
    //      { filename: 'ticket.png', content: qrDataUrl.split(',')[1] }
    //   ]
    // });

    console.log(`[Email Gateway] Pretending to send email to ${email} for ${guestName}`);
    
    return res.status(200).json({ success: true, message: 'Email sent successfully (Simulated)' });
  } catch (error) {
    console.error('Email API Error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
