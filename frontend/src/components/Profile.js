import React, { useState, useEffect } from 'react';
import { userAPI, personalityAPI, coinsAPI } from '../api';
import { tierFor } from '../relationship';
import './Profile.css';
import './PremiumModal.css';

function Profile({ premium }) {
  const [profile, setProfile] = useState(null);
  const [personality, setPersonality] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
    loadPersonality();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      setProfile(response.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const loadPersonality = async () => {
    try {
      const response = await personalityAPI.get();
      setPersonality(response.data);
      setEditName(response.data.name);
      setEditPersonality(response.data.personality);
    } catch (err) {
      console.error('Failed to load personality:', err);
    }
  };

  const handleUpdatePersonality = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await personalityAPI.update(editName, editPersonality);
      setPersonality({ name: editName, personality: editPersonality });
      setIsEditing(false);
      setMessage('✅ Personality updated!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Failed to update personality');
    } finally {
      setLoading(false);
    }
  };

  const addFreeCoins = async () => {
    setLoading(true);
    try {
      await coinsAPI.addCoins(50, 'Daily bonus');
      setMessage('✅ +50 coins added!');
      loadProfile();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Failed to add coins');
    } finally {
      setLoading(false);
    }
  };

  if (!profile || !personality) {
    return <div className="profile-container">Loading...</div>;
  }

  const tier = tierFor(profile.affection || 0);

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h2>👤 Your Profile</h2>

        {premium && (
          <div className="profile-premium-row">
            <span className="premium-badge">💎 PREMIUM MEMBER</span>
          </div>
        )}

        <div className="profile-stats">
          <div className="stat">
            <span className="stat-label">Username</span>
            <span className="stat-value">{profile.username}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Coins</span>
            <span className="stat-value">🪙 {profile.coins}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Level</span>
            <span className="stat-value">⭐ {profile.level}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Experience</span>
            <span className="stat-value">✨ {profile.experience}</span>
          </div>
          <div className="stat stat-wide">
            <span className="stat-label">Relationship</span>
            <span className="stat-value">
              {tier.current.emoji} {tier.current.name}
            </span>
            <div className="stat-track">
              <div className="stat-fill" style={{ width: `${tier.progress * 100}%` }} />
            </div>
            <span className="stat-sub">
              {tier.next
                ? `${profile.affection || 0} / ${tier.next.min} affection to ${tier.next.name}`
                : 'Maximum affection reached 💞'}
            </span>
          </div>
        </div>

        <button
          onClick={addFreeCoins}
          disabled={loading}
          className="bonus-btn"
        >
          🎁 Get 50 Free Coins
        </button>
      </div>

      <div className="personality-card">
        <h2>💕 Your Girlfriend</h2>

        {!isEditing ? (
          <div className="personality-view">
            <div className="personality-item">
              <label>Name</label>
              <p>{personality.name}</p>
            </div>
            <div className="personality-item">
              <label>Personality</label>
              <p>{personality.personality}</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="edit-btn"
            >
              ✏️ Customize
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePersonality} className="personality-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Personality Traits</label>
              <input
                type="text"
                value={editPersonality}
                onChange={(e) => setEditPersonality(e.target.value)}
                placeholder="e.g., sweet, playful, mysterious"
                required
                disabled={loading}
              />
            </div>

            <div className="form-buttons">
              <button type="submit" disabled={loading} className="save-btn">
                💾 Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={loading}
                className="cancel-btn"
              >
                ❌ Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {message && <div className="status-message">{message}</div>}

      <div className="info-card">
        <h3>💡 How It Works</h3>
        <ul>
          <li>💬 Chat with her to earn XP and build affection</li>
          <li>⭐ Every 50 XP levels you up and pays a coin bonus</li>
          <li>🎁 Send gifts from the chat — bigger gifts build affection faster</li>
          <li>💞 Grow from Just Met to Crush, Dating, In Love... Soulmate</li>
          <li>🪙 Premium messages (-5 coins) build affection 3x faster</li>
          <li>💕 Customize her name, personality, and room theme</li>
        </ul>
      </div>
    </div>
  );
}

export default Profile;
