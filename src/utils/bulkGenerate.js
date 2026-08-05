import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';

export const generateBulkTickets = async (guests, eventName, onProgress) => {
  const zip = new JSZip();
  const folder = zip.folder(`${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Tickets`);

  const total = guests.length;
  
  for (let i = 0; i < total; i++) {
    const guest = guests[i];
    
    // Generate QR Code as Data URL
    const qrDataUrl = await QRCode.toDataURL(guest.id, {
      width: 250,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // Load QR image onto a canvas to add text
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // We will draw it on a larger canvas to give it a ticket feel
    canvas.width = 400;
    canvas.height = 550;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header (Event Name)
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(eventName, canvas.width / 2, 60);

    ctx.fillStyle = "#64748b";
    ctx.font = "18px Arial";
    ctx.fillText("Official Entry Ticket", canvas.width / 2, 95);

    // Draw QR Code in center
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = qrDataUrl;
    });
    
    // Draw Border around QR
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 130, 260, 260);
    ctx.drawImage(img, 75, 135, 250, 250);

    // Guest Details
    ctx.fillStyle = "#000000";
    ctx.font = "bold 28px Arial";
    ctx.fillText(guest.name, canvas.width / 2, 440);

    if (guest.category) {
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 20px Arial";
      ctx.fillText(guest.category, canvas.width / 2, 480);
    }

    if (guest.table) {
      ctx.fillStyle = "#475569";
      ctx.font = "20px Arial";
      ctx.fillText(`Table: ${guest.table}`, canvas.width / 2, 515);
    }

    // Convert Canvas to Blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    // Add to ZIP
    const safeName = guest.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    folder.file(`${safeName}_Ticket.png`, blob);

    // Report progress
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  // Generate and Download ZIP
  if (onProgress) onProgress(100); // Finalizing
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Tickets.zip`);
};
