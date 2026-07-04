import React, { useState } from 'react';
import { premiumAPI } from '../api';
import './PremiumModal.css';

const PERKS = [
  { emoji: '💎', title: 'Premium Badge', desc: 'Exclusive glowing badge on your profile' },
  { emoji: '👑', title: '5 Exclusive Gifts', desc: 'Crown, Champagne, Yacht, Private Jet & Castle' },
  { emoji: '💬', title: 'Free Premium Chat', desc: 'Premium AI responses at no coin cost' },
  { emoji: '🪙', title: '+200 Coin Bonus', desc: 'Instant welcome bonus when you join' },
  { emoji: '🚀', title: 'All New Updates', desc: 'Every future feature, unlocked first' },
];

function PremiumModal({ onClose, onSubscribed }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await premiumAPI.subscribe();
      setSuccess(true);
      setTimeout(() => onSubscribed(response.data), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Subscription failed');
      setLoading(false);
    }
  };

  return (
    <div className="premium-overlay" onClick={onClose}>
      <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="premium-success">
            <div className="premium-success-icon">💎</div>
            <h2>Welcome to Premium!</h2>
            <p>Your badge is live. Enjoy the good life, baby ✨</p>
          </div>
        ) : (
          <>
            <button className="premium-close" onClick={onClose}>✕</button>

            <div className="premium-gem">💎</div>
            <h2 className="premium-title">GO PREMIUM</h2>
            <p className="premium-subtitle">Unlock the VIP experience</p>

            <div className="premium-perks">
              {PERKS.map((perk) => (
                <div key={perk.title} className="premium-perk">
                  <span className="perk-emoji">{perk.emoji}</span>
                  <div className="perk-text">
                    <strong>{perk.title}</strong>
                    <span>{perk.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="premium-price">
              <span className="price-amount">$9.99</span>
              <span className="price-period">/ month</span>
            </div>

            {error && <div className="premium-error">{error}</div>}

            <button
              className="premium-subscribe-btn"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Processing...' : '💎 Subscribe Now'}
            </button>
            <p className="premium-fineprint">Cancel anytime. Renews monthly.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default PremiumModal;
