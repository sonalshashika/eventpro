import { db, ref, set } from '../firebase';

/**
 * Logs an action to the event's audit log.
 * @param {string} eventId - The current event ID
 * @param {object} user - The currently logged-in user object (from useAuth)
 * @param {string} action - Short description of the action (e.g., 'Scanned Ticket', 'Manual Check-in', 'Added Guest')
 * @param {string} details - Additional context (e.g., the guest's name)
 */
export const logAction = (eventId, user, action, details) => {
  if (!eventId || !user) return;
  
  const timestamp = Date.now();
  const logId = `log_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
  const logsRef = ref(db, `eventData/${eventId}/logs/${logId}`);
  
  const logEntry = {
    id: logId,
    timestamp,
    userEmail: user.email || 'Unknown User',
    userId: user.uid,
    action,
    details
  };
  
  set(logsRef, logEntry).catch(err => {
    console.error("Failed to write audit log:", err);
  });
};
