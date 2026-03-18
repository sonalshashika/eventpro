import React, { useState, useEffect, useMemo } from 'react'; 
import { Routes, Route, Navigate } from 'react-router-dom';
import ExcelImport from './components/ExcelImport'; 
import Login from './components/Login';
import { useAuth } from './context/AuthContext';
import './App.css'; 
import { db, ref, onValue, set } from './firebase'; 

function App() { 
  const { user, role, logout, isAdmin, isManager, events, currentEventId, setCurrentEventId } = useAuth();
  
  // Authorized Events List - Reusable filter
  const authorizedEvents = React.useMemo(() => {
    if (isAdmin) return events;
    if (isManager) return events.filter(e => (e.managers && e.managers[user?.uid]) || e.managerId === user?.uid);
    return events.filter(e => e.staff && e.staff[user?.uid]);
  }, [events, isAdmin, isManager, user?.uid]);

  const [guests, setGuests] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [view, setView] = useState('dashboard'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Close menu on navigation
  const handleNav = (tab) => {
    setView(tab);
    setIsMenuOpen(false);
  };
  const [isSynced, setIsSynced] = useState(false); 
  const [customColumns, setCustomColumns] = useState([]);
  const [enabledProps, setEnabledProps] = useState({ category: true, table: true });
  
  // Manual Entry State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGuestForm, setNewGuestForm] = useState({ name: '', category: '', table: '', statuses: {} });

  // Auto-select event if none selected and events exist
  useEffect(() => {
    if (!currentEventId && authorizedEvents.length > 0) {
      setCurrentEventId(authorizedEvents[0].id);
    } else if (currentEventId && authorizedEvents.length > 0 && !authorizedEvents.find(e => e.id === currentEventId)) {
      // If current event is not authorized, reset to first authorized event
      setCurrentEventId(authorizedEvents[0].id);
    }
  }, [authorizedEvents, currentEventId, setCurrentEventId]);

  // Real-time synchronization listener for guests
  useEffect(() => { 
    if (!user || !currentEventId) return;
    
    // Data sync
    const guestsRef = ref(db, `eventData/${currentEventId}/guests`); 
    const unsubscribe = onValue(guestsRef, (snapshot) => { 
      const data = snapshot.val(); 
      setGuests(data || []); 
      setIsSynced(true); 
    }); 
    return () => unsubscribe(); 
  }, [user, currentEventId]); 

  // Real-time synchronization listener for initial loading and current event sync
  useEffect(() => {
    if (!user || !currentEventId) return;
    
    // Config sync
    const columnsRef = ref(db, `eventData/${currentEventId}/config/columns`);
    const unsubscribeCols = onValue(columnsRef, (snapshot) => {
      setCustomColumns(snapshot.val() || []);
    });

    // Listen for enabled properties (Category/Table)
    const propsRef = ref(db, `eventData/${currentEventId}/config/props`);
    const unsubscribeProps = onValue(propsRef, (snapshot) => {
      setEnabledProps(snapshot.val() || { category: true, table: true });
    });

    return () => {
      unsubscribeCols();
      unsubscribeProps();
    };
  }, [user, currentEventId]);

  const updateGuestField = (id, field, value) => { 
    if (!currentEventId) return;
    const updatedGuests = guests.map(g => g.id === id ? { ...g, [field]: value } : g ); 
    set(ref(db, `eventData/${currentEventId}/guests`), updatedGuests); 
  }; 

  const handleImport = (newGuests) => { 
    if (!isManager || !currentEventId) return;
    const updatedGuests = [...guests, ...newGuests]; 
    set(ref(db, `eventData/${currentEventId}/guests`), updatedGuests); 
    setView('list'); 
  }; 

  const handleAddGuest = (e) => {
    e.preventDefault();
    if (!newGuestForm.name.trim() || !currentEventId) return;
    
    const newGuest = {
      id: `guest_${Date.now()}`,
      name: newGuestForm.name,
      category: enabledProps.category ? newGuestForm.category : '',
      table: enabledProps.table ? newGuestForm.table : '',
      arrived: false,
      statuses: newGuestForm.statuses || {}
    };

    const updatedGuests = [...guests, newGuest];
    set(ref(db, `eventData/${currentEventId}/guests`), updatedGuests);
    setNewGuestForm({ name: '', category: '', table: '', statuses: {} });
    setShowAddForm(false);
  };

  const handleReset = () => { 
    if (!isAdmin || !currentEventId) return;
    if (window.confirm('Clear all guests for this event?')) {
      set(ref(db, `eventData/${currentEventId}/guests`), []); 
    }
  }; 

  // SECURITY GATE: Filter data for unauthorized events at the consumption level
  const displayedGuests = useMemo(() => {
    if (!user || !currentEventId) return [];
    const isAuthorized = authorizedEvents.find(e => e.id === currentEventId);
    return isAuthorized ? guests : [];
  }, [guests, authorizedEvents, currentEventId, user]);

  const displayedCustomColumns = useMemo(() => {
    if (!user || !currentEventId) return [];
    const isAuthorized = authorizedEvents.find(e => e.id === currentEventId);
    return isAuthorized ? customColumns : [];
  }, [customColumns, authorizedEvents, currentEventId, user]);

  const filteredGuests = displayedGuests.filter(g => {
    const searchLower = searchTerm.toLowerCase();
    
    // Core search (Name)
    if (g.name && g.name.toLowerCase().includes(searchLower)) return true;
    
    // Optional fields search
    if (enabledProps.category && g.category && g.category.toLowerCase().includes(searchLower)) return true;
    if (g.phone && g.phone.toLowerCase().includes(searchLower)) return true;
    if (g.email && g.email.toLowerCase().includes(searchLower)) return true;

    // Table search
    if (enabledProps.tableNumber && g.tableNumber && String(g.tableNumber).toLowerCase().includes(searchLower)) return true;
    
    // Custom Searchable Columns
    return displayedCustomColumns.some(col => 
      col.searchable && 
      g.statuses && 
      g.statuses[col.id] !== undefined && 
      g.statuses[col.id] !== null &&
      String(g.statuses[col.id]).toLowerCase().includes(searchLower)
    );
  }); 

  const stats = useMemo(() => {
    const arrived = displayedGuests.filter(g => g.arrived).length;
    return {
      total: displayedGuests.length,
      arrived,
      pending: displayedGuests.length - arrived
    };
  }, [displayedGuests]);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return ( 
    <div className="app-container"> 
      <header className="glass-header"> 
        <div className="logo-section"> 
          <div className="logo">EVENT<span>PRO</span></div> 
          
          <div className="event-selector-container">
            <select 
              className="event-selector-glass"
              value={currentEventId || ''}
              onChange={(e) => setCurrentEventId(e.target.value)}
            >
              <option value="" disabled>Select Event</option>
              {authorizedEvents.map(event => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))
              }
            </select>
          </div>

          {isSynced && ( 
            <div className="sync-indicator"> 
              <span className="sync-dot"></span> Live {role} 
            </div> 
          )} 
        </div> 

        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>

        <nav className={isMenuOpen ? 'nav-open' : ''}>
          <button 
            className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('dashboard')}
          >Dashboard</button>
          
          <button 
            className={`nav-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => handleNav('list')}
          >Guest List</button>
          
          <button 
            className={`nav-btn ${view === 'report' ? 'active' : ''}`}
            onClick={() => handleNav('report')}
          >Report</button>
          
          {isManager && (
            <button 
              className={`nav-btn ${view === 'import' ? 'active' : ''}`}
              onClick={() => handleNav('import')}
            >Import</button>
          )}

          {(isAdmin || isManager) && (
            <button 
              className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
              onClick={() => handleNav('admin')}
            >{isAdmin ? 'Admin' : 'Team'}</button>
          )}
          
          <button 
            className="nav-btn logout-btn"
            onClick={logout}
          >Logout</button>
        </nav> 
      </header> 

      <main>
        {view === 'dashboard' && (
          <div className="dashboard-content animate-fade-in">
            <h2 className="title animate-slide-right stagger-1">Event Overview</h2>
            
            <div className="stats-grid">
              <div className="stat-card glass-card animate-scale-in stagger-1">
                <span className="label">TOTAL GUESTS</span>
                <span className="value">{stats.total}</span>
              </div>
              <div className="stat-card arrived glass-card animate-scale-in stagger-2">
                <span className="label">ARRIVED</span>
                <span className="value">{stats.arrived}</span>
              </div>
              <div className="stat-card pending glass-card animate-scale-in stagger-3">
                <span className="label">REMAINING</span>
                <span className="value">{stats.pending}</span>
              </div>
              {customColumns.filter(col => col.showOnDashboard).map((col, idx) => (
                  <div key={col.id} className="stat-card glass-card animate-scale-in" style={{ animationDelay: `${0.4 + idx * 0.1}s` }}>
                    <span className="label text-uppercase">{col.label}</span>
                    <span className="value">{guests.filter(g => g.statuses && g.statuses[col.id]).length}</span>
                  </div>
              ))}
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="list-view animate-fade-in">
            <div className="list-header animate-slide-right stagger-1">
              <h2 className="title">Guest Management</h2>
              {isManager && (
                <button 
                  className={`btn-primary ${showAddForm ? 'btn-danger' : ''}`} 
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? 'Cancel' : 'Add Guest'}
                </button>
              )}
            </div>

            <div className="search-bar animate-slide-right stagger-2">
              <input 
                type="text" 
                className="input-glass" 
                placeholder="Search by name or category..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {showAddForm && (
              <div className="manual-entry-form glass-card animate-scale-in" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <h4 className="animate-slide-right stagger-1">Add New Guest</h4>
                <form onSubmit={handleAddGuest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <input 
                    type="text" className="input-glass" placeholder="Guest Name (Mandatory)" required
                    value={newGuestForm.name} onChange={(e) => setNewGuestForm({...newGuestForm, name: e.target.value})}
                  />
                  {enabledProps.category && (
                    <input 
                      type="text" className="input-glass" placeholder="Category" 
                      value={newGuestForm.category} onChange={(e) => setNewGuestForm({...newGuestForm, category: e.target.value})}
                    />
                  )}
                  {enabledProps.table && (
                    <input 
                      type="text" className="input-glass" placeholder="Table Number" 
                      value={newGuestForm.table} onChange={(e) => setNewGuestForm({...newGuestForm, table: e.target.value})}
                    />
                  )}
                  
                  {/* Custom Columns in Form */}
                  {customColumns.map(col => (
                    col.type === 'text' ? (
                      <input 
                        key={col.id} type="text" className="input-glass" placeholder={col.label}
                        value={newGuestForm.statuses[col.id] || ''}
                        onChange={(e) => setNewGuestForm({
                          ...newGuestForm, 
                          statuses: { ...newGuestForm.statuses, [col.id]: e.target.value }
                        })}
                      />
                    ) : (
                      <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          type="button"
                          className={`btn-action btn-custom ${newGuestForm.statuses[col.id] ? 'active' : ''}`}
                          style={{ flex: 1 }}
                          onClick={() => setNewGuestForm({
                            ...newGuestForm,
                            statuses: { ...newGuestForm.statuses, [col.id]: !newGuestForm.statuses[col.id] }
                          })}
                        >
                          {col.label}: {newGuestForm.statuses[col.id] ? 'YES' : 'NO'}
                        </button>
                      </div>
                    )
                  ))}

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" className="btn-primary">Save Guest</button>
                  </div>
                </form>
              </div>
            )}
            <div className="guest-grid">
              {filteredGuests.map((guest, index) => (
                <div 
                  key={guest.id} 
                  className={`guest-card glass-card animate-scale-in arrived-${guest.arrived}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="card-header">
                    <div className="name-group">
                      <h4>{guest.name}</h4>
                      {enabledProps.category && (
                        <span className={`category-badge ${guest.category?.toLowerCase()}`}>
                          {guest.category}
                        </span>
                      )}
                    </div>
                    <span className={`badge ${guest.arrived ? 'badge-success' : 'badge-pending'}`}>
                      {guest.arrived ? 'ARRIVED' : 'PENDING'}
                    </span>
                  </div>

                  <div className="card-body">
                    {enabledProps.table && (
                      <div className="table-info">
                        <span className="label">Table Number</span>
                        <span className="table-num">{guest.table}</span>
                      </div>
                    )}

                    <div className="guest-actions">
                      <button 
                        className={`btn-primary w-full ${guest.arrived ? 'secondary' : ''}`}
                        onClick={() => updateGuestField(guest.id, 'arrived', !guest.arrived)}
                      >
                        {guest.arrived ? 'Undo Arrival' : 'Mark as Arrived'}
                      </button>
                      
                      {customColumns.map(col => (
                        col.type === 'text' ? (
                          <input
                            key={col.id}
                            type="text"
                            className="input-glass"
                            style={{ marginTop: '0.75rem' }}
                            placeholder={col.label}
                            value={(guest.statuses && guest.statuses[col.id]) || ''}
                            onChange={(e) => {
                              const newStatuses = { ...(guest.statuses || {}), [col.id]: e.target.value };
                              updateGuestField(guest.id, 'statuses', newStatuses);
                            }}
                          />
                        ) : (
                          <button
                            key={col.id}
                            className={`btn-action btn-custom ${guest.statuses && guest.statuses[col.id] ? 'active' : ''}`}
                            style={{ marginTop: '0.75rem', width: '100%' }}
                            onClick={() => {
                              const newStatuses = { ...(guest.statuses || {}), [col.id]: !(guest.statuses && guest.statuses[col.id]) };
                              updateGuestField(guest.id, 'statuses', newStatuses);
                            }}
                          >
                            {col.label}: {guest.statuses && guest.statuses[col.id] ? 'YES' : 'NO'}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {filteredGuests.length === 0 && (
                <div className="empty-state glass-card">
                  <p>No guests found matching your search.</p>
                  {isManager && guests.length === 0 && <p className="text-muted">Hint: Use the 'Import' tab to upload guests.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="report-view glass-card animate-fade-in">
            <h3>Event Attendance Report</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Name</th>
                  {enabledProps.category && <th style={{ textAlign: 'left' }}>Category</th>}
                  {enabledProps.table && <th style={{ textAlign: 'center' }}>Table</th>}
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {customColumns.map(col => <th key={col.id}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {guests.map(guest => (
                  <tr key={guest.id}>
                    <td>{guest.name}</td>
                    {enabledProps.category && <td style={{ textAlign: 'left' }}>{guest.category}</td>}
                    {enabledProps.table && <td style={{ textAlign: 'center' }}>{guest.table}</td>}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${guest.arrived ? 'badge-success' : 'badge-pending'}`}>
                        {guest.arrived ? 'Arrived' : 'Pending'}
                      </span>
                    </td>
                    {customColumns.map(col => (
                      <td key={col.id}>
                        {col.type === 'text' ? (
                          (guest.statuses && guest.statuses[col.id]) || '-'
                        ) : (
                          guest.statuses && guest.statuses[col.id] ? (
                            <span className="badge badge-success">Yes</span>
                          ) : (
                            <span className="badge badge-pending">No</span>
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'import' && isManager && (
          <div className="animate-fade-in">
            <ExcelImport 
              onImport={handleImport} 
              onReset={handleReset} 
              showReset={isAdmin} 
              enabledProps={enabledProps}
              customColumns={customColumns}
            />
          </div>
        )}

        {view === 'admin' && (isAdmin || isManager) && (
          <div className="animate-fade-in">
            <AdminPanel columns={customColumns} enabledProps={enabledProps} />
          </div>
        )}
      </main>
    </div>
  );
}

function AdminPanel({ columns, enabledProps }) {
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState('toggle');
  const [newPassword, setNewPassword] = useState('');
  const [pwdStatus, setPwdStatus] = useState({ type: '', msg: '' });
  
  // User Management State
  const [systemUsers, setSystemUsers] = useState({});
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'staff' });
  const [userStatus, setUserStatus] = useState({ type: '', msg: '' });
  
  const { user, changePassword, createSystemUser, deleteUser, isAdmin, isManager, events, currentEventId, setCurrentEventId } = useAuth();
  
  // State for new event creation
  const [newEvent, setNewEvent] = useState({ name: '', managers: {} });

  // State for tracking deletions in progress
  const [deletingIds, setDeletingIds] = useState([]);

  // Listen for all users
  useEffect(() => {
    console.log("AdminPanel: Listening for users, isAdmin/isManager:", isAdmin, isManager);
    if (!isAdmin && !isManager) return;
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      console.log("AdminPanel: Received users snapshot");
      setSystemUsers(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [isAdmin, isManager]);

  const addColumn = () => {
    console.log("AdminPanel: addColumn called", { newColLabel, newColType, currentEventId });
    if (!newColLabel.trim() || !currentEventId) return;
    const colId = newColLabel.toLowerCase().replace(/\s+/g, '_');
    if (columns.some(c => c.id === colId)) {
        alert('This column ID already exists.');
        return;
    }
    const newCol = { id: colId, label: newColLabel, type: newColType, showOnDashboard: false, searchable: true };
    set(ref(db, `eventData/${currentEventId}/config/columns`), [...columns, newCol])
      .then(() => console.log("AdminPanel: Column added successfully"))
      .catch(err => console.error("AdminPanel: Error adding column", err));
    setNewColLabel('');
    setNewColType('toggle');
  };

  const removeColumn = (index) => {
    console.log("AdminPanel: removeColumn called", { index, currentEventId });
    if (!currentEventId) return;
    const updated = columns.filter((_, i) => i !== index);
    set(ref(db, `eventData/${currentEventId}/config/columns`), updated);
  };

  const handleChangePassword = async () => {
    console.log("AdminPanel: handleChangePassword called");
    if (newPassword.length < 6) {
        setPwdStatus({ type: 'error', msg: 'Min 6 characters.' });
        return;
    }
    try {
        await changePassword(newPassword);
        setPwdStatus({ type: 'success', msg: 'Updated!' });
        setNewPassword('');
    } catch (err) {
        setPwdStatus({ type: 'error', msg: err.message });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    console.log("AdminPanel: handleCreateUser called", newUser);
    if (!newUser.username || newUser.password.length < 6) {
        setUserStatus({ type: 'error', msg: 'Username required & Password min 6 chars.' });
        return;
    }
    try {
        await createSystemUser(newUser.username, newUser.password, newUser.role);
        setUserStatus({ type: 'success', msg: `User ${newUser.username} created!` });
        setNewUser({ username: '', password: '', role: 'staff' });
    } catch (err) {
        setUserStatus({ type: 'error', msg: err.message });
    }
  };

  const revokeUserAccess = async (uid) => {
    if (window.confirm('Revoke access for this user?')) {
      setDeletingIds(prev => [...prev, uid]);
      try {
        await deleteUser(uid);
        setUserStatus({ type: 'success', msg: 'Access revoked.' });
      } catch (err) {
        setUserStatus({ type: 'error', msg: err.message });
      } finally {
        setDeletingIds(prev => prev.filter(id => id !== uid));
      }
    }
  };

  const deleteEvent = async (eventId, eventName) => {
    console.log("AdminPanel: deleteEvent called", { eventId, eventName });
    if (window.confirm(`Are you sure you want to delete "${eventName}"? This will permanently remove all associated data.`)) {
        const doubleCheck = prompt('Type "DELETE" to confirm:');
        if (doubleCheck && doubleCheck.toUpperCase() === 'DELETE') {
            setDeletingIds(prev => [...prev, eventId]);
            try {
                await set(ref(db, `events/${eventId}`), null);
                await set(ref(db, `eventData/${eventId}`), null);
                if (currentEventId === eventId) {
                    setCurrentEventId(null);
                    localStorage.removeItem('currentEventId');
                }
                console.log("AdminPanel: Event deleted successfully");
                alert('Event deleted successfully.');
            } catch (err) {
                console.error("AdminPanel: Error deleting event", err);
                alert('Error deleting event: ' + err.message);
            } finally {
                setDeletingIds(prev => prev.filter(id => id !== eventId));
            }
        } else if (doubleCheck !== null) {
            alert('Confirmation text did not match. Deletion cancelled.');
        }
    }
  };

  const handleCreateEvent = async () => {
    console.log("AdminPanel: handleCreateEvent called", newEvent);
    if (!newEvent.name) return;
    try {
        const eventId = `event_${Date.now()}`;
        const eventData = {
            name: newEvent.name,
            managers: newEvent.managers || {}
        };
        await set(ref(db, `events/${eventId}`), eventData);
        setNewEvent({ name: '', managers: {} });
        setCurrentEventId(eventId);
        console.log("AdminPanel: Event created and selected", eventId);
    } catch (err) {
        console.error("AdminPanel: Error creating event", err);
        alert('Error creating event: ' + err.message);
    }
  };

  const toggleEventManager = async (eventId, managerUid) => {
    console.log("AdminPanel: toggleEventManager called", { eventId, managerUid });
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const currentManagers = event.managers || {};
    const newManagers = { ...currentManagers };

    if (newManagers[managerUid]) {
        delete newManagers[managerUid];
    } else {
        newManagers[managerUid] = true;
    }

    try {
        await set(ref(db, `events/${eventId}/managers`), newManagers);
        console.log("AdminPanel: Event managers updated");
    } catch (err) {
        console.error("AdminPanel: Error updating event managers", err);
        alert('Error updating managers: ' + err.message);
    }
  };

  const toggleEventStaff = async (eventId, staffUid) => {
    console.log("AdminPanel: toggleEventStaff called", { eventId, staffUid });
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const currentStaff = event.staff || {};
    const newStaff = { ...currentStaff };

    if (newStaff[staffUid]) {
        delete newStaff[staffUid];
    } else {
        newStaff[staffUid] = true;
    }

    try {
        await set(ref(db, `events/${eventId}/staff`), newStaff);
        console.log("AdminPanel: Event staff updated");
    } catch (err) {
        console.error("AdminPanel: Error updating event staff", err);
        alert('Error updating staff: ' + err.message);
    }
  };

  const handleHardReset = async () => {
    console.log("AdminPanel: handleHardReset called");
    if (window.confirm('WARNING: This will delete ALL events and data. Proceed?')) {
        const doubleCheck = prompt('Type "RESET" to confirm:');
        if (doubleCheck && doubleCheck.toUpperCase() === 'RESET') {
            try {
                await set(ref(db, 'events'), null);
                await set(ref(db, 'eventData'), null);
                alert('Database cleaned!');
                window.location.reload();
            } catch (err) {
                alert('Error resetting database: ' + err.message);
            }
        }
    }
  };

  return (
    <div className="admin-panel animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 400px', gap: '2rem' }}>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3>System Configuration</h3>
        
        {/* Event Management Section (Admin & Manager) */}
        {isManager && (
          <div className="config-section" style={{ marginTop: '2rem' }}>
            <h4>Event Management</h4>
            <p className="small text-muted">{isAdmin ? 'Create or remove events and assign teams.' : 'Manage staff access for your events.'}</p>
            
            {isAdmin && (
              <div className="add-col-form" style={{ marginBottom: '2rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="text" className="input-glass" placeholder="Event Name (e.g., PF Event)" 
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                  />
                  <button className="btn-primary" onClick={handleCreateEvent}>Create</button>
                </div>
                <div className="manager-toggle-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <p className="small text-muted" style={{ width: '100%', marginBottom: '0.2rem' }}>Select Managers:</p>
                  {Object.entries(systemUsers)
                    .filter(([, u]) => u.role === 'manager')
                    .map(([uid, u]) => (
                      <button 
                        key={uid} 
                        className={`btn-action btn-custom ${newEvent.managers?.[uid] ? 'active' : ''}`}
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => {
                          const updatedManagers = { ...(newEvent.managers || {}) };
                          if (updatedManagers[uid]) {
                            delete updatedManagers[uid];
                          } else {
                            updatedManagers[uid] = true;
                          }
                          setNewEvent({ ...newEvent, managers: updatedManagers });
                        }}
                      >
                        {u.username}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="columns-list">
              <p className="small text-muted" style={{ marginBottom: '0.5rem' }}>{isAdmin ? 'All Events:' : 'My Events:'}</p>
              {events
                .filter(event => isAdmin || (event.managers && event.managers[user?.uid]) || event.managerId === user?.uid)
                .map((event) => (
                <div key={event.id} className="column-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{event.name}</div>
                      <div className="small text-muted">Role: {isAdmin ? 'Admin' : 'Manager'}</div>
                    </div>
                    {isAdmin && (
                      <button 
                        className="btn-icon-delete" 
                        onClick={() => deleteEvent(event.id, event.name)}
                        disabled={deletingIds.includes(event.id)}
                      >
                        {deletingIds.includes(event.id) ? '⌛' : '×'}
                      </button>
                    )}
                  </div>
                  
                  {/* Manager Assignment (Admin only) */}
                  {isAdmin && (
                    <div className="manager-toggle-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                      <p className="small text-muted" style={{ width: '100%', fontSize: '10px', marginBottom: '0.25rem' }}>Assign Managers:</p>
                      {Object.entries(systemUsers)
                        .filter(([, u]) => u.role === 'manager')
                        .map(([uid, u]) => (
                          <button 
                            key={uid} 
                            className={`btn-action btn-custom ${event.managers?.[uid] ? 'active' : ''}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            onClick={() => toggleEventManager(event.id, uid)}
                          >
                            {u.username}
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Staff Assignment (Admin & Manager) */}
                  <div className="manager-toggle-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <p className="small text-muted" style={{ width: '100%', fontSize: '10px', marginBottom: '0.25rem' }}>Assign Staff Access:</p>
                    {Object.entries(systemUsers)
                      .filter(([, u]) => u.role === 'staff')
                      .map(([uid, u]) => (
                        <button 
                          key={uid} 
                          className={`btn-action btn-custom ${event.staff?.[uid] ? 'active' : ''}`}
                          style={{ padding: '2px 8px', fontSize: '10px' }}
                          onClick={() => toggleEventStaff(event.id, uid)}
                        >
                          {u.username}
                        </button>
                      ))}
                    {Object.entries(systemUsers).filter(([, u]) => u.role === 'staff').length === 0 && (
                      <p className="small text-muted italic" style={{ fontSize: '10px' }}>No staff accounts available.</p>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="small text-muted italic">No events created yet.</p>}
            </div>
          </div>
        )}

        {/* Custom Columns Section */}
        <div className="config-section" style={{ marginTop: '2rem' }}>
          <h4>{currentEventId ? `Event Columns: ${events.find(e => e.id === currentEventId)?.name}` : 'Select an Event to manage columns'}</h4>
          <div className="add-col-form" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input 
              type="text" className="input-glass" placeholder="Label (e.g., Gift Given)" 
              value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <select 
              className="input-glass" value={newColType} 
              onChange={(e) => setNewColType(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="toggle">Toggle Button</option>
              <option value="text">Text Info</option>
            </select>
            <button className="btn-primary" onClick={addColumn}>Add</button>
          </div>
          
          <div className="props-config" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <p className="small text-muted" style={{ marginBottom: '0.8rem' }}>Optional Columns (Toggles):</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className={`btn-action btn-custom ${enabledProps.category ? 'active' : ''}`}
                onClick={() => set(ref(db, `eventData/${currentEventId}/config/props/category`), !enabledProps.category)}
              >
                Category
              </button>
              <button 
                className={`btn-action btn-custom ${enabledProps.table ? 'active' : ''}`}
                onClick={() => set(ref(db, `eventData/${currentEventId}/config/props/table`), !enabledProps.table)}
              >
                Table
              </button>
            </div>
            <p className="small text-muted" style={{ marginTop: '0.5rem', fontSize: '10px' }}>Name and Status are always mandatory.</p>
          </div>

          <div className="columns-list">
            {columns.map((col, index) => (
              <div key={col.id} className="column-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>{col.label}</span>
                    <div style={{ display: 'flex', gap: '0.6rem', marginLeft: 'auto' }}>
                      <label className="small text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '10px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={!!col.showOnDashboard} 
                          onChange={(e) => {
                            const updated = [...columns];
                            updated[index] = { ...col, showOnDashboard: e.target.checked };
                            set(ref(db, `eventData/${currentEventId}/config/columns`), updated);
                          }}
                        />
                        Dash
                      </label>
                      <label className="small text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '10px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={col.searchable !== false} // Default to true if not specified
                          onChange={(e) => {
                            const updated = [...columns];
                            updated[index] = { ...col, searchable: e.target.checked };
                            set(ref(db, `eventData/${currentEventId}/config/columns`), updated);
                          }}
                        />
                        Search
                      </label>
                    </div>
                </div>
                <button className="btn-icon-delete" onClick={() => removeColumn(index)}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="config-section" style={{ marginTop: '2rem' }}>
          <h4>User Accounts</h4>
          <div className="users-list" style={{ marginTop: '1rem' }}>
            {Object.entries(systemUsers)
              .filter(([uid, data]) => {
                if (isAdmin) return true;
                // Managers only see themselves and staff
                return uid === user?.uid || data.role === 'staff';
              })
              .map(([uid, data]) => (
                <div key={uid} className="column-item" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{data.username || 'Unnamed'}</div>
                    <div className="small text-muted">{data.role}</div>
                  </div>
                  {uid !== user?.uid && (isAdmin || (isManager && data.role === 'staff')) && (
                    <button 
                      className="btn-icon-delete" 
                      title="Revoke Access"
                      onClick={() => revokeUserAccess(uid)}
                      disabled={deletingIds.includes(uid)}
                    >
                      {deletingIds.includes(uid) ? '⌛' : '×'}
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem', height: 'fit-content' }}>
        <h3>Security & Access</h3>
        
        {/* Create User Form */}
        <div className="config-section">
          <h4>Create New User</h4>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" className="input-glass" placeholder="Username" 
              value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})}
            />
            <input 
              type="password" className="input-glass" placeholder="Password" 
              value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})}
            />
            <select 
              className="input-glass" value={newUser.role} 
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              disabled={!isAdmin}
            >
              <option value="staff">Staff (Attendance Only)</option>
              {isAdmin && <option value="manager">Manager (Imports + Reports)</option>}
              {isAdmin && <option value="admin">Admin (Full Control)</option>}
            </select>
            <button type="submit" className="btn-primary">Create Account</button>
            {userStatus.msg && <p className={`small ${userStatus.type === 'error' ? 'text-danger' : 'text-success'}`}>{userStatus.msg}</p>}
          </form>
        </div>

        {/* Password Update */}
        <div className="config-section" style={{ marginTop: '2rem' }}>
          <h4>Update Password</h4>
          <div className="add-col-form" style={{ marginTop: '1rem' }}>
            <input 
              type="password" className="input-glass" placeholder="New Password" 
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            />
            <button className="btn-primary" onClick={handleChangePassword}>Update</button>
          </div>
          {pwdStatus.msg && <p className="small text-success">{pwdStatus.msg}</p>}
        </div>

        {/* Danger Zone */}
        {isAdmin && (
          <div className="config-section" style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,0,0,0.2)', paddingTop: '2rem' }}>
            <h4 style={{ color: '#ff4444' }}>Danger Zone</h4>
            <p className="small text-muted">Use these options to start a completely fresh system.</p>
            <button 
              className="btn-primary" 
              style={{ background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)', marginTop: '1rem' }}
              onClick={handleHardReset}
            >
              Hard Reset Database
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
