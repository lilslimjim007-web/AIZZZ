import React, { useState } from 'react';
import { authAPI } from '../api';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      if (isRegister) {
        response = await authAPI.register(username, password);
      } else {
        response = await authAPI.login(username, password);
      }

      onLogin(response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>✨ AIZZZ</h1>
        <p className="subtitle">Your AI Girlfriend Awaits</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Loading...' : isRegister ? 'Create Account' : 'Login'}
          </button>
        </form>

        <div className="toggle-mode">
          <span>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="toggle-btn"
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
