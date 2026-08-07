export default async function handler(req, res) {
  const { eventId, guestId } = req.query;

  // We must return a 1x1 transparent GIF as quickly as possible
  // so the email client doesn't hang or show a broken image.
  const transparentGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // We write the image and end the request to the client immediately.
  res.write(transparentGif);
  res.end();

  // If parameters are missing, just exit early in the background
  if (!eventId || !guestId) {
    return;
  }

  try {
    // 1. Fetch the guest list for this event
    const dbUrl = `https://events-tabal-default-rtdb.firebaseio.com/eventData/${eventId}/guests.json`;
    const response = await fetch(dbUrl);
    
    if (!response.ok) return;
    const guests = await response.json();
    
    if (!guests || !Array.isArray(guests)) return;

    // 2. Find the guest by ID
    const guestIndex = guests.findIndex(g => g && g.id === guestId);
    
    if (guestIndex !== -1) {
      // 3. Update their emailStatus to 'opened' using PATCH
      const patchUrl = `https://events-tabal-default-rtdb.firebaseio.com/eventData/${eventId}/guests/${guestIndex}.json`;
      
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailStatus: 'opened',
          emailOpenedAt: Date.now()
        })
      });
    }
  } catch (err) {
    // Silently fail in background, tracking is best-effort
    console.error('Tracking pixel error:', err);
  }
}
