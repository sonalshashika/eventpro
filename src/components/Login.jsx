import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to log in.');
        }
    };



    return (
        <div className="login-container animate-fade-in">
            <div className="glass-card login-card animate-scale-in stagger-1">
                <div className="logo animate-slide-right stagger-2">EVENT<span>PRO</span></div>
                <h2 className="animate-fade-in stagger-3">Welcome Back</h2>
                <p className="text-muted animate-fade-in stagger-4">Sign in to manage your event</p>
                
                {error && <div className="error-message animate-scale-in">{error}</div>}
                
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            className="input-glass" 
                            placeholder="Username (e.g., admin)"
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            className="input-glass" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="btn-primary w-full">Sign In</button>
                </form>
            </div>
        </div>
    );
}

export default Login;
