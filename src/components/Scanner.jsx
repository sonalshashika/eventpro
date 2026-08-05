import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db, ref, set, get } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';

export default function Scanner({ currentEventId }) {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Hardware Scanner state
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);
  const qrCodeRef = useRef(null);

  // Initialize Camera Scanner
  useEffect(() => {
    if (!isCameraActive) return;

    const html5QrCode = new Html5Qrcode("qr-reader");
    qrCodeRef.current = html5QrCode;

    const onScanSuccess = (decodedText, decodedResult) => {
      // Pause scanner to prevent multiple rapid scans
      // 2 is the value for SCANNING state in Html5Qrcode
      if (html5QrCode.getState() === 2) {
        html5QrCode.pause();
      }
      processScan(decodedText);
    };

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      (err) => {
        // Ignore scan failures as they happen continuously
      }
    ).catch(err => {
      console.error("Error starting camera", err);
      setError("Failed to start camera. Please ensure permissions are granted and device has a camera.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(console.error);
      }
    };
  }, [isCameraActive, currentEventId]);

  // Hardware Scanner Listener (Global Keyboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if currently displaying a result or error (waiting for OK)
      if (scanResult || error) return;

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
            logAction(currentEventId, user, 'Scan Attempt (Already Arrived)', `Guest: ${guest.name}`);
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
            logAction(currentEventId, user, 'Scanned Checked-in', `Guest: ${guest.name}`);
            
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
  };

  const handleNextScan = () => {
    setScanResult(null);
    setError(null);
    bufferRef.current = '';
    if (qrCodeRef.current && qrCodeRef.current.getState() === 3 /* PAUSED */) {
      qrCodeRef.current.resume();
    }
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
          <div className="alert alert-danger animate-scale-in text-center">
            <strong>Error:</strong> {error}
            <div className="mt-3">
              <button className="btn-primary" onClick={handleNextScan}>OK / Next Scan</button>
            </div>
          </div>
        )}
        
        {scanResult && (
          <div className={`alert alert-${scanResult.type} animate-scale-in text-center`}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {scanResult.type === 'success' ? '✅' : '⚠️'}
            </div>
            <h2>{scanResult.guest.name}</h2>
            <p style={{ fontSize: '1.25rem' }}><strong>Status:</strong> {scanResult.message}</p>
            {scanResult.guest.category && <p><strong>Category:</strong> {scanResult.guest.category}</p>}
            {scanResult.guest.table && <p><strong>Table:</strong> {scanResult.guest.table}</p>}
            <div className="mt-4">
              <button className="btn-primary w-100" style={{ fontSize: '1.25rem', padding: '1rem' }} onClick={handleNextScan}>OK / Next Scan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
