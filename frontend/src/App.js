import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Login from './components/Login';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Store from './components/Store';
import PremiumModal from './components/PremiumModal';
import { userAPI } from './api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  // Land on the store when returning from a Stripe Checkout redirect
  const [view, setView] = useState(
    window.location.search.includes('purchase=') ? 'store' : 'chat'
  );
  const [premium, setPremium] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const response = await userAPI.getProfile();
      setPremium(Boolean(response.data.premium));
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      loadProfile();
    } else {
      localStorage.removeItem('token');
      setPremium(false);
    }
  }, [token, loadProfile]);

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
        {premium ? (
          <span className="premium-badge">💎 PREMIUM</span>
        ) : (
          <button className="premium-btn" onClick={() => setShowPremium(true)}>
            💎 Go Premium
          </button>
        )}
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
        {view === 'chat' && (
          <Chat premium={premium} onOpenPremium={() => setShowPremium(true)} />
        )}
        {view === 'store' && <Store />}
        {view === 'profile' && <Profile premium={premium} />}
      </main>

      {showPremium && (
        <PremiumModal
          onClose={() => setShowPremium(false)}
          onSubscribed={() => {
            setPremium(true);
            setShowPremium(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
