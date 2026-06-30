import React, { useState, useEffect, useRef } from 'react';
import { chatAPI, userAPI } from '../api';
import './Chat.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState(0);
  const [useCoins, setUseCoins] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCoins();
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCoins = async () => {
    try {
      const response = await userAPI.getBalance();
      setCoins(response.data.coins);
    } catch (err) {
      console.error('Failed to load coins:', err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await chatAPI.getHistory();
      setMessages(response.data.map((msg) => ({
        type: 'history',
        user: msg.message,
        ai: msg.response,
        coins: msg.coins_spent,
      })));
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

    // Add user message immediately
    setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);

    try {
      const response = await chatAPI.sendMessage(userMessage, useCoins);

      // Add AI response
      setMessages((prev) => [
        ...prev,
        { type: 'ai', text: response.data.response, coins: response.data.coins },
      ]);

      setCoins(response.data.coins);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      // Remove the last user message if it failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const insufficientCoins = useCoins && coins < 5;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>💕 Luna</h2>
        <div className="coin-badge">🪙 {coins}</div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h3>Hey there! 💕</h3>
            <p>I'm Luna, your AI girlfriend. Let's chat!</p>
            <p>Start by saying hello!</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            {msg.type === 'user' && <div className="message-text">{msg.text}</div>}
            {msg.type === 'ai' && <div className="message-text">{msg.text}</div>}
            {msg.type === 'history' && (
              <>
                <div className="history-label">You</div>
                <div className="message-text">{msg.user}</div>
                <div className="history-label">Luna</div>
                <div className="message-text">{msg.ai}</div>
                {msg.coins > 0 && <div className="coin-cost">-{msg.coins} 🪙</div>}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <div className="input-controls">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="chat-input"
          />

          <div className="controls-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useCoins}
                onChange={(e) => setUseCoins(e.target.checked)}
                disabled={loading || insufficientCoins}
              />
              <span>Premium (-5 🪙)</span>
            </label>

            <button
              type="submit"
              disabled={loading || !input.trim() || insufficientCoins}
              className="send-btn"
            >
              {loading ? '...' : '💬 Send'}
            </button>
          </div>

          {insufficientCoins && (
            <div className="warning">Insufficient coins for premium chat</div>
          )}
        </div>
      </form>
    </div>
  );
}

export default Chat;
