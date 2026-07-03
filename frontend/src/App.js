import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Store from './components/Store';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  // Land on the store when returning from a Stripe Checkout redirect
  const [view, setView] = useState(
    window.location.search.includes('purchase=') ? 'store' : 'chat'
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
    setView('chat');
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>✨ AIZZZ</h1>
        <nav className="nav-tabs">
          <button
            className={`nav-btn ${view === 'chat' ? 'active' : ''}`}
            onClick={() => setView('chat')}
          >
            💬 Chat
          </button>
          <button
            className={`nav-btn ${view === 'store' ? 'active' : ''}`}
            onClick={() => setView('store')}
          >
            🪙 Store
          </button>
          <button
            className={`nav-btn ${view === 'profile' ? 'active' : ''}`}
            onClick={() => setView('profile')}
          >
            👤 Profile
          </button>
          <button className="nav-btn logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'chat' && <Chat />}
        {view === 'store' && <Store />}
        {view === 'profile' && <Profile />}
      </main>
    </div>
  );
}

export default App;
