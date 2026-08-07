import QRCode from 'qrcode';

// Helper to generate the QR data URL silently
const getSilentQRDataURL = async (guest, eventName, eventLogoUrl) => {
  // Generate base QR
  const qrDataUrl = await QRCode.toDataURL(guest.id, {
    width: 250,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  // Load into canvas to add text
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 400;
  canvas.height = 550;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (eventLogoUrl) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "Anonymous";
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = eventLogoUrl;
      });
      const scale = Math.min(300 / logoImg.width, 80 / logoImg.height);
      const w = logoImg.width * scale;
      const h = logoImg.height * scale;
      const x = (canvas.width - w) / 2;
      ctx.drawImage(logoImg, x, 15, w, h);
    } catch (err) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText(eventName, canvas.width / 2, 60);
    }
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(eventName, canvas.width / 2, 60);
  }

  // Draw QR
  const qrImg = new Image();
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });
  ctx.drawImage(qrImg, (canvas.width - 250) / 2, 120, 250, 250);

  // Draw Guest Name
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(guest.name, canvas.width / 2, 420);
  
  ctx.fillStyle = "#64748b";
  ctx.font = "18px Arial";
  ctx.fillText(`ID: ${guest.id}`, canvas.width / 2, 460);

  if (guest.category) {
    ctx.fillText(`Category: ${guest.category}`, canvas.width / 2, 490);
  }
  if (guest.table) {
    ctx.fillText(`Table: ${guest.table}`, canvas.width / 2, 520);
  }

  return canvas.toDataURL("image/png");
};

export const runEmailCampaign = async (guests, eventName, messagingSettings, eventLogoUrl, onProgress, updateGuestStatus) => {
  const eligibleGuests = guests.filter(g => g.email && g.email.includes('@'));
  if (eligibleGuests.length === 0) {
    alert("No guests with valid email addresses found!");
    return;
  }

  if (!messagingSettings || !messagingSettings.apiKey) {
    alert("Please configure your Resend API Key in the Admin Messaging tab first.");
    return;
  }

  const confirmRun = window.confirm(`You are about to send tickets to ${eligibleGuests.length} guests. Proceed?`);
  if (!confirmRun) return;

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < eligibleGuests.length; i++) {
    const guest = eligibleGuests[i];
    
    // Update progress (percentage and text)
    onProgress(Math.round(((i) / eligibleGuests.length) * 100), `Sending to ${guest.name}...`);

    try {
      const qrDataUrl = await getSilentQRDataURL(guest, eventName, eventLogoUrl);
      
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guest.email,
          guestName: guest.name,
          eventName,
          ticketId: guest.id,
          qrDataUrl,
          apiKey: messagingSettings.apiKey,
          subject: messagingSettings.subject,
          htmlBody: messagingSettings.htmlBody,
          fromEmail: messagingSettings.fromEmail
        })
      });

      if (res.ok) {
        successCount++;
        // Update Firebase to mark email as sent
        if (updateGuestStatus) {
           updateGuestStatus(guest.id, 'emailStatus', 'sent', guest.name);
           updateGuestStatus(guest.id, 'emailSentAt', Date.now(), guest.name);
        }
      } else {
        failCount++;
      }
    } catch (e) {
      console.error(`Failed to send to ${guest.email}`, e);
      failCount++;
    }
  }

  onProgress(100, `Completed! ${successCount} sent, ${failCount} failed.`);
};
