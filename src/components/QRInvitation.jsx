import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRInvitation({ guest, eventName, eventLogo, onClose }) {
  const qrRef = useRef();

  const handleDownload = () => {
    const svg = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height + 40; // Add padding for text
      
      // White background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0);
      
      // Add name at bottom
      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText(guest.name, canvas.width / 2, canvas.height - 15);

      const pngFile = canvas.toDataURL("image/png");
      
      const downloadLink = document.createElement("a");
      downloadLink.download = `${guest.name.replace(/\s+/g, '_')}_Ticket.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
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

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleDownload}>
            Download Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
