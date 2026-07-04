import React, { useState, useEffect, useRef } from 'react';
import { chatAPI, userAPI, giftsAPI, personalityAPI } from '../api';
import { tierFor } from '../relationship';
import Room from './Room';
import GiftAnimation from './GiftAnimation';
import './Chat.css';

const THEMES = [
  { id: 'pink', label: 'Pink Bedroom' },
  { id: 'red', label: 'Red Room' },
  { id: 'space', label: 'Neon Space' },
];

function Chat({ premium, onOpenPremium }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState(0);
  const [useCoins, setUseCoins] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('roomTheme') || 'pink');
  const [gfName, setGfName] = useState('Luna');
  const [gifts, setGifts] = useState([]);
  const [showGifts, setShowGifts] = useState(false);
  const [playingGift, setPlayingGift] = useState(null);
  const [affection, setAffection] = useState(0);
  const [levelUp, setLevelUp] = useState(null);
  const [kissKey, setKissKey] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadProfile();
    loadChatHistory();
    loadGifts();
    personalityAPI.get().then((r) => setGfName(r.data.name || 'Luna')).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('roomTheme', theme);
  }, [theme]);

  // Refresh coins when premium status changes (welcome bonus)
  useEffect(() => {
    loadProfile();
  }, [premium]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      setCoins(response.data.coins);
      setAffection(response.data.affection || 0);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  // Applies coins/affection/level-up data that every backend response now includes
  const applyProgress = (data) => {
    setCoins(data.coins);
    if (data.affection !== undefined) setAffection(data.affection);
    if (data.levelUp) {
      setLevelUp({ bonus: data.bonus });
      setTimeout(() => setLevelUp(null), 3200);
    }
    setKissKey((k) => k + 1); // she blows a kiss on every reply/gift
  };

  const loadGifts = async () => {
    try {
      const response = await giftsAPI.list();
      setGifts(response.data);
    } catch (err) {
      console.error('Failed to load gifts:', err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await chatAPI.getHistory();
      const history = [];
      [...response.data].reverse().forEach((msg) => {
        history.push({ type: 'user', text: msg.message });
        history.push({ type: 'ai', text: msg.response });
      });
      setMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setError('');
    setLoading(true);

    setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);

    try {
      const response = await chatAPI.sendMessage(userMessage, useCoins);
      setMessages((prev) => [...prev, { type: 'ai', text: response.data.response }]);
      applyProgress(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleBuyGift = async (gift) => {
    if (gift.premium && !premium) {
      setShowGifts(false);
      onOpenPremium();
      return;
    }
    if (coins < gift.price || playingGift) return;
    setError('');
    setShowGifts(false);

    try {
      const response = await giftsAPI.buy(gift.id);
      applyProgress(response.data);
      setPlayingGift(response.data.gift);

      setMessages((prev) => [
        ...prev,
        { type: 'user', text: `🎁 Sent a ${gift.name} ${gift.emoji}` },
        { type: 'ai', text: response.data.reaction },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Gift failed to send');
    }
  };

  const insufficientCoins = useCoins && coins < 5 && !premium;
  const tier = tierFor(affection);

  return (
    <div className={`chat-container theme-${theme}`}>
      {playingGift && (
        <GiftAnimation gift={playingGift} onDone={() => setPlayingGift(null)} />
      )}

      {levelUp && (
        <div className="levelup-burst">
          <div className="levelup-star">⭐</div>
          <div className="levelup-text">LEVEL UP!</div>
          <div className="levelup-bonus">+{levelUp.bonus} 🪙</div>
        </div>
      )}

      <div className="chat-header">
        <h2>💕 {gfName}</h2>
        <div className="theme-switcher">
          {THEMES.map((t) => (
            <button
              key={t.id}
              title={t.label}
              className={`theme-dot dot-${t.id} ${theme === t.id ? 'active' : ''}`}
              onClick={() => setTheme(t.id)}
            />
          ))}
        </div>
        <div className="coin-badge">🪙 {coins}</div>
      </div>

      <div className="affection-bar" title={`Affection: ${affection}`}>
        <span className="affection-status">
          {tier.current.emoji} {tier.current.name}
        </span>
        <div className="affection-track">
          <div
            className="affection-fill"
            style={{ width: `${tier.progress * 100}%` }}
          />
        </div>
        <span className="affection-next">
          {tier.next ? `${affection}/${tier.next.min} → ${tier.next.emoji}` : 'MAX 💞'}
        </span>
      </div>

      <div className="room-viewport">
        <Room theme={theme} gfName={gfName} kissKey={kissKey} />

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h3>Hey there! 💕</h3>
              <p>I'm {gfName}... come closer and talk to me.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.type}`}>
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showGifts && (
        <div className="gift-drawer">
          {gifts.map((gift) => {
            const premiumLocked = gift.premium && !premium;
            const cantAfford = !premiumLocked && coins < gift.price;
            return (
              <button
                key={gift.id}
                className={`gift-card ${cantAfford ? 'locked' : ''} ${gift.premium ? 'premium-gift' : ''} ${premiumLocked ? 'premium-locked' : ''}`}
                onClick={() => handleBuyGift(gift)}
                disabled={cantAfford}
                title={premiumLocked ? 'Premium members only - tap to upgrade' : gift.name}
              >
                {gift.premium && <span className="gift-card-tag">{premiumLocked ? '🔒 💎' : '💎'}</span>}
                <span className="gift-card-emoji">{gift.emoji}</span>
                <span className="gift-card-name">{gift.name}</span>
                <span className="gift-card-price">🪙 {gift.price}</span>
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <div className="input-controls">
          <div className="input-row">
            <button
              type="button"
              className={`gift-toggle-btn ${showGifts ? 'open' : ''}`}
              onClick={() => setShowGifts(!showGifts)}
              title="Send a gift"
            >
              🎁
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${gfName}...`}
              disabled={loading}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || insufficientCoins}
              className="send-btn"
            >
              {loading ? '💭' : '💬'}
            </button>
          </div>

          <div className="controls-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useCoins}
                onChange={(e) => setUseCoins(e.target.checked)}
                disabled={loading}
              />
              <span>{premium ? 'Premium chat (FREE 💎)' : 'Premium (-5 🪙)'}</span>
            </label>
            {insufficientCoins && !premium && (
              <span className="warning">Not enough coins</span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export default Chat;
