import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRInvitation({ guest, eventName, eventId, eventLogo, messagingSettings, updateGuestField, onClose }) {
  const qrRef = useRef();
  const [isEmailing, setIsEmailing] = useState(false);
  const [isSMSing, setIsSMSing] = useState(false);

  const getQRDataURL = () => {
    return new Promise((resolve) => {
      const svg = qrRef.current.querySelector('svg');
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height + 40; // Add padding for text
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = "black";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(guest.name, canvas.width / 2, canvas.height - 15);
        resolve(canvas.toDataURL("image/png"));
      };
      
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const handleDownload = async () => {
    const pngFile = await getQRDataURL();
    const downloadLink = document.createElement("a");
    downloadLink.download = `${guest.name.replace(/\s+/g, '_')}_Ticket.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };

  const handleSendEmail = async () => {
    if (!guest.email) return alert('No email provided for this guest.');
    if (!messagingSettings?.apiKey) return alert('Please configure the Resend API Key in Admin Settings first.');
    
    setIsEmailing(true);
    try {
      const qrDataUrl = await getQRDataURL();
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guest.email,
          guestName: guest.name,
          eventName,
          eventId,
          ticketId: guest.id,
          qrDataUrl,
          apiKey: messagingSettings.apiKey,
          subject: messagingSettings.subject,
          htmlBody: messagingSettings.htmlBody,
          fromEmail: messagingSettings.fromEmail
        })
      });
      
      if (res.ok) {
        alert('Email sent successfully!');
        if (updateGuestField) {
           updateGuestField(guest.id, 'emailStatus', 'sent', guest.name);
           updateGuestField(guest.id, 'emailSentAt', Date.now(), guest.name);
        }
      } else {
        const error = await res.json();
        alert(`Failed to send email: ${error.message}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsEmailing(false);
    }
  };

  const handleSendSMS = async () => {
    if (!guest.phone) return alert('No phone provided for this guest.');
    setIsSMSing(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: guest.phone,
          guestName: guest.name,
          eventName,
          ticketId: guest.id
        })
      });
      if (res.ok) {
        alert('SMS framework called successfully! (Configure API keys in Vercel to send real SMS)');
      } else {
        alert('Failed to send SMS.');
      }
    } catch (error) {
      console.error(error);
      alert('Error sending SMS.');
    } finally {
      setIsSMSing(false);
    }
  };


  return (
    <div className="modal-overlay">
      <div className="modal-content invitation-modal">
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <div className="invitation-card" ref={qrRef}>
          {eventLogo ? (
            <img src={eventLogo} alt="Event Logo" style={{ maxHeight: '80px', objectFit: 'contain', marginBottom: '1rem', width: '100%' }} />
          ) : (
            <h3>{eventName}</h3>
          )}
          <p className="invite-subtitle">Official Entry Ticket</p>
          
          <div className="qr-wrapper">
            <QRCodeSVG 
              value={guest.id} 
              size={200}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"Q"}
              includeMargin={true}
            />
          </div>
          
          <div className="guest-details">
            <h2 className="guest-name">{guest.name}</h2>
            {guest.category && <span className="guest-category">{guest.category}</span>}
            {guest.table && <p className="guest-table">Table: <strong>{guest.table}</strong></p>}
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', width: '100%' }}>
          <button className="btn-primary" onClick={handleDownload} style={{ width: '100%', justifyContent: 'center' }}>
            📥 Download Ticket
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn-action" 
              style={{ flex: 1, backgroundColor: '#25D366', color: 'white', borderColor: '#25D366', justifyContent: 'center' }}
              onClick={() => {
                const text = `Hi ${guest.name}, here is your invitation for ${eventName}. Please present your QR ticket at the entrance. Ticket ID: ${guest.id}`;
                const url = `https://wa.me/${guest.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
              }}
            >
              💬 WhatsApp
            </button>
            <button 
              className="btn-action" 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleSendEmail}
              disabled={isEmailing}
            >
              {isEmailing ? 'Sending...' : '📧 Email'}
            </button>
            <button 
              className="btn-action" 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleSendSMS}
              disabled={isSMSing}
            >
              {isSMSing ? 'Sending...' : '📱 SMS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
