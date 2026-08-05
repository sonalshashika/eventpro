import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db, ref, set, get } from '../firebase';

export default function Scanner({ currentEventId }) {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Hardware Scanner state
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);

  // Initialize Camera Scanner
  useEffect(() => {
    if (!isCameraActive) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    const onScanSuccess = (decodedText, decodedResult) => {
      // Pause scanner to prevent multiple rapid scans
      scanner.pause(true);
      processScan(decodedText).finally(() => {
        setTimeout(() => scanner.resume(), 2000); // Resume after 2s
      });
    };

    scanner.render(onScanSuccess, (err) => {
      // Ignore scan failures as they happen continuously when no QR code is in frame
    });

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [isCameraActive, currentEventId]);

  // Hardware Scanner Listener (Global Keyboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          const scannedId = bufferRef.current;
          processScan(scannedId);
          bufferRef.current = '';
        }
      } else {
        // Collect characters
        // Valid guest IDs usually don't contain spaces and are alphanumeric/underscores
        if (e.key.length === 1) {
          bufferRef.current += e.key;
        }

        // Clear buffer if typing is too slow (human typing vs hardware scanner)
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 100); // 100ms timeout between keys
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutRef.current);
    };
  }, [currentEventId]);

  const processScan = async (guestId) => {
    if (!currentEventId) {
      setError("No event selected.");
      return;
    }
    
    setScanResult(null);
    setError(null);

    try {
      const guestRef = ref(db, `eventData/${currentEventId}/guests`);
      const snapshot = await get(guestRef);
      
      if (snapshot.exists()) {
        const guests = snapshot.val();
        const guestIndex = guests.findIndex(g => g.id === guestId);
        
        if (guestIndex !== -1) {
          const guest = guests[guestIndex];
          
          if (guest.arrived) {
            setScanResult({
              type: 'warning',
              guest: guest,
              message: 'Guest has ALREADY been checked in!'
            });
          } else {
            // Update to arrived
            const updatedGuests = [...guests];
            updatedGuests[guestIndex] = { ...guest, arrived: true };
            await set(guestRef, updatedGuests);
            
            setScanResult({
              type: 'success',
              guest: guest,
              message: 'Check-in successful!'
            });
            
            // Play success sound (optional, assuming we have a generic beep)
            // const audio = new Audio('/success-beep.mp3');
            // audio.play().catch(e => console.log('Audio play failed', e));
          }
        } else {
          setError(`Invalid QR Code. Guest not found in this event. (ID: ${guestId})`);
        }
      } else {
        setError("Event data not found.");
      }
    } catch (err) {
      setError("Error processing scan: " + err.message);
    }
    
    // Auto-clear result after 5 seconds
    setTimeout(() => {
      setScanResult(null);
      setError(null);
    }, 5000);
  };

  return (
    <div className="scanner-container animate-fade-in">
      <h2 className="title text-center">QR Code Scanner</h2>
      <p className="text-center text-muted mb-4">
        Ready for Hardware Scanner (USB). Just plug it in and scan!
      </p>

      <div className="scanner-controls text-center mb-4">
        <button 
          className={`btn-primary ${isCameraActive ? 'btn-danger' : ''}`}
          onClick={() => setIsCameraActive(!isCameraActive)}
        >
          {isCameraActive ? 'Turn Off Camera Scanner' : 'Use Camera / Webcam Scanner'}
        </button>
      </div>

      {isCameraActive && (
        <div className="qr-reader-wrapper glass-card mx-auto">
          <div id="qr-reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
        </div>
      )}

      {!isCameraActive && (
        <div className="hardware-scanner-placeholder glass-card mx-auto text-center" style={{ maxWidth: '500px', padding: '3rem 1rem' }}>
          <div className="scanner-icon" style={{ fontSize: '4rem', opacity: 0.5 }}>📳</div>
          <h3>Waiting for scan...</h3>
          <p className="text-muted small">Listening for keyboard/hardware scanner input.</p>
        </div>
      )}

      {/* Result Display */}
      <div className="scan-results mx-auto mt-4" style={{ maxWidth: '500px' }}>
        {error && (
          <div className="alert alert-danger animate-scale-in">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {scanResult && (
          <div className={`alert alert-${scanResult.type} animate-scale-in text-center`}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {scanResult.type === 'success' ? '✅' : '⚠️'}
            </div>
            <h3>{scanResult.guest.name}</h3>
            <p><strong>Status:</strong> {scanResult.message}</p>
            {scanResult.guest.category && <p><strong>Category:</strong> {scanResult.guest.category}</p>}
            {scanResult.guest.table && <p><strong>Table:</strong> {scanResult.guest.table}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
