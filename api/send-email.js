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
    const { email, guestName, eventName, eventId, ticketId, qrDataUrl, apiKey, subject, htmlBody, fromEmail } = req.body;

    if (!email || !guestName || !ticketId || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields or API key' });
    }

    // Initialize Resend with the provided key from the client
    const resend = new Resend(apiKey);

    // Prepare template variables
    const finalSubject = subject ? subject.replace(/{guestName}/g, guestName).replace(/{eventName}/g, eventName) : `Your Ticket for ${eventName}`;
    
    let finalHtml = '';
    if (htmlBody) {
      finalHtml = htmlBody.replace(/{guestName}/g, guestName).replace(/{eventName}/g, eventName).replace(/{ticketId}/g, ticketId);
      finalHtml = `<div style="font-family: sans-serif;">${finalHtml}</div>`;
    } else {
      finalHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${guestName},</h2>
          <p>Here is your official invitation for <strong>${eventName}</strong>.</p>
          <p>Please present the attached QR code ticket at the entrance.</p>
          <p style="color: #666; font-size: 0.9em;">Ticket ID: ${ticketId}</p>
        </div>
      `;
    }

    // Embed Tracking Pixel if possible
    if (eventId && ticketId && req.headers.host) {
      const protocol = req.headers.host.includes('localhost') ? 'http' : 'https';
      const trackingUrl = `${protocol}://${req.headers.host}/api/track-open?eventId=${eventId}&guestId=${ticketId}`;
      finalHtml += `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    }

    // Send the email
    const data = await resend.emails.send({
      from: fromEmail || 'tickets@resend.dev', // Fallback to resend.dev testing domain
      to: email,
      subject: finalSubject,
      html: finalHtml,
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
