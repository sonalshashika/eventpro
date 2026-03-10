import React, { useState, useEffect } from 'react';
import ExcelImport from './components/ExcelImport';
import './App.css';
import { db, ref, onValue, set } from './firebase';

// Sample Data
const initialGuests = [
  { id: 1, name: 'Alice Johnson', category: 'Family', table: 5, arrived: false },
  { id: 2, name: 'Bob Smith', category: 'VIP', table: 12, arrived: true },
  { id: 3, name: 'Charlie Brown', category: 'Family', table: 8, arrived: false },
  { id: 4, name: 'Diana Ross', category: 'VIP', table: 3, arrived: false },
  { id: 5, name: 'Edward Norton', category: 'General', table: 7, arrived: true },
];

function App() {
  const [guests, setGuests] = useState(() => {
    const saved = localStorage.getItem('event_guests');
    return saved !== null ? JSON.parse(saved) : initialGuests;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('dashboard');
  const [isSynced, setIsSynced] = useState(false);

  // Real-time synchronization listener
  useEffect(() => {
    const guestsRef = ref(db, 'guests');
    const unsubscribe = onValue(guestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGuests(data);
        localStorage.setItem('event_guests', JSON.stringify(data));
      } else {
        // If snapshot is empty (e.g. after reset), set empty state
        setGuests([]);
        localStorage.setItem('event_guests', JSON.stringify([]));
      }
      setIsSynced(true);
    });

    return () => unsubscribe();
  }, []);

  const toggleArrival = (id) => {
    const updatedGuests = guests.map(g =>
      g.id === id ? { ...g, arrived: !g.arrived } : g
    );
    // Writing to Firebase triggers the onValue listener for all devices
    set(ref(db, 'guests'), updatedGuests);
  };

  const handleImport = (newGuests) => {
    const updatedGuests = [...guests, ...newGuests];
    set(ref(db, 'guests'), updatedGuests);
    setView('list');
  };

  const handleReset = () => {
    set(ref(db, 'guests'), []);
  };

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.category && g.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: guests.length,
    arrived: guests.filter(g => g.arrived).length,
    pending: guests.filter(g => !g.arrived).length
  };

  return (
    <div className="app-container">
      <header className="glass-header">
        <div className="logo-section">
          <div className="logo">EVENT<span>TABAL</span></div>
          {isSynced && (
            <div className="sync-indicator">
              <span className="sync-dot"></span>
              Live Sync
            </div>
          )}
        </div>
        <nav>
          <button
            className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            Guest List
          </button>
          <button
            className={`nav-btn ${view === 'report' ? 'active' : ''}`}
            onClick={() => setView('report')}
          >
            Report
          </button>
          <button
            className={`nav-btn ${view === 'import' ? 'active' : ''}`}
            onClick={() => setView('import')}
          >
            Import
          </button>
        </nav>
      </header>

      <main>
        {view === 'dashboard' && (
          <div className="dashboard animate-fade-in">
            <h1 className="title">Event Overview</h1>
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <span className="label">Total Guests</span>
                <span className="value">{stats.total}</span>
              </div>
              <div className="glass-card stat-card arrived">
                <span className="label">Arrived</span>
                <span className="value">{stats.arrived}</span>
              </div>
              <div className="glass-card stat-card pending">
                <span className="label">Remaining</span>
                <span className="value">{stats.pending}</span>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="guest-section animate-fade-in">
            <div className="search-bar">
              <input
                type="text"
                className="input-glass"
                placeholder="Search by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="guest-grid">
              {filteredGuests.length === 0 ? (
                <div className="glass-card empty-state">
                  <p>No guests found. Import a list to get started!</p>
                  <button className="btn-primary" onClick={() => setView('import')}>Go to Import</button>
                </div>
              ) : (
                filteredGuests.map(guest => (
                  <div key={guest.id} className="glass-card guest-card">
                    <div className="card-header">
                      <div className="name-group">
                        <h3>{guest.name}</h3>
                        <span className={`badge category-badge ${guest.category?.toLowerCase()}`}>
                          {guest.category}
                        </span>
                      </div>
                      <span className={`badge ${guest.arrived ? 'badge-arrived' : 'badge-pending'}`}>
                        {guest.arrived ? 'Arrived' : 'Pending'}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="table-info">
                        <span className="label">Table Number</span>
                        <span className="table-num">{guest.table}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleArrival(guest.id)}
                      className={`btn-primary ${guest.arrived ? 'secondary' : ''}`}
                    >
                      {guest.arrived ? 'Mark as Unarrived' : 'Mark as Arrived'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="report-section animate-fade-in">
            <h1 className="title">Attendance Report</h1>
            <div className="glass-card report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Table</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.sort((a, b) => a.table - b.table).map(guest => (
                    <tr key={guest.id}>
                      <td>{guest.name}</td>
                      <td>
                        <span className={`badge category-badge ${guest.category?.toLowerCase()}`}>
                          {guest.category}
                        </span>
                      </td>
                      <td>{guest.table}</td>
                      <td>
                        <span className={`badge ${guest.arrived ? 'badge-arrived' : 'badge-pending'}`}>
                          {guest.arrived ? 'Arrived' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-primary export-btn" onClick={() => window.print()}>
                Print Report
              </button>
            </div>
          </div>
        )}

        {view === 'import' && (
          <div className="import-section animate-fade-in">
            <h1 className="title">Setup Guest List</h1>
            <ExcelImport onImport={handleImport} onReset={handleReset} />
          </div>
        )}
      </main>
    </div>
  );
}


export default App;
