import React, { useState, useEffect } from 'react';
import { db, ref, onValue } from '../firebase';

export default function AuditLog({ currentEventId }) {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!currentEventId) return;

    const logsRef = ref(db, `eventData/${currentEventId}/logs`);
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array and sort by timestamp descending (newest first)
        const logsArray = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
        setLogs(logsArray);
      } else {
        setLogs([]);
      }
    });

    return () => unsubscribe();
  }, [currentEventId]);

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.userEmail.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.details.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="report-view glass-card animate-fade-in">
      <div className="list-header">
        <h3 style={{ margin: 0 }}>Audit Log</h3>
      </div>
      
      <div className="search-bar mt-3 mb-4">
        <input 
          type="text" 
          className="input-glass w-100" 
          placeholder="Search by user, action, or guest..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="report-table">
          <thead>
            <tr>
              <th style={{ width: '200px' }}>Date & Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id}>
                <td className="text-muted" style={{ fontSize: '0.85rem' }}>{formatDate(log.timestamp)}</td>
                <td><strong>{log.userEmail}</strong></td>
                <td>
                  <span className={`badge ${log.action.includes('Undo') || log.action.includes('Reset') ? 'badge-pending' : 'badge-success'}`}>
                    {log.action}
                  </span>
                </td>
                <td>{log.details}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
