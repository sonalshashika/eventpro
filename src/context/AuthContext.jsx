import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, ref, get, set, onValue, remove } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('currentUser')) || null);
    const [role, setRole] = useState(localStorage.getItem('currentRole') || null);
    const [events, setEvents] = useState([]);
    const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('currentEventId') || null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeEvents = onValue(ref(db, 'events'), (snapshot) => {
            const data = snapshot.val() || {};
            const eventList = Object.entries(data).map(([id, details]) => ({ id, ...details }));
            setEvents(eventList);
        });
        return () => unsubscribeEvents();
    }, []);

    useEffect(() => {
        if (currentEventId) {
            localStorage.setItem('currentEventId', currentEventId);
        }
    }, [currentEventId]);

    const logout = () => {
        setUser(null);
        setRole(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentRole');
    };

    // Check session validity on startup
    useEffect(() => {
        const verifySession = async () => {
            if (user && user.uid) {
                const userRef = ref(db, `users/${user.uid}`);
                const snapshot = await get(userRef);
                if (!snapshot.exists()) {
                    logout();
                }
            }
            setLoading(false);
        };
        verifySession();
    }, [user]);

    const login = async (username, password) => {
        // Find user by username
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        const users = snapshot.val() || {};
        
        const userEntry = Object.entries(users).find(([uid, data]) => 
            (data.username === username || uid === username) && data.password === password
        );

        if (userEntry) {
            const [uid, userData] = userEntry;
            const sessionUser = { uid, username: userData.username };
            setUser(sessionUser);
            setRole(userData.role);
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));
            localStorage.setItem('currentRole', userData.role);
            return sessionUser;
        } else {
            throw new Error('Invalid username or password');
        }
    };

    const setupAdmin = async (initialPassword) => {
        const adminId = 'admin_' + Date.now();
        const adminData = {
            username: 'admin',
            password: initialPassword,
            role: 'admin'
        };
        await set(ref(db, `users/${adminId}`), adminData);
        
        // Log in immediately
        const sessionUser = { uid: adminId, username: 'admin' };
        setUser(sessionUser);
        setRole('admin');
        localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        localStorage.setItem('currentRole', 'admin');
        return adminId;
    };

    const createSystemUser = async (username, password, selectedRole) => {
        const uid = 'user_' + Date.now();
        await set(ref(db, `users/${uid}`), {
            username,
            password,
            role: selectedRole
        });
        return uid;
    };

    const deleteUser = async (uid) => {
        if (uid === user?.uid) throw new Error('Cannot delete yourself');
        await remove(ref(db, `users/${uid}`));
    };

    const changePassword = async (newPassword) => {
        if (!user) throw new Error('No user logged in');
        await set(ref(db, `users/${user.uid}/password`), newPassword);
    };

    const value = {
        user,
        role,
        login,
        logout,
        setupAdmin,
        createSystemUser,
        deleteUser,
        changePassword,
        events,
        currentEventId,
        setCurrentEventId,
        isAdmin: role === 'admin',
        isManager: role === 'admin' || role === 'manager',
        isStaff: !!role
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
