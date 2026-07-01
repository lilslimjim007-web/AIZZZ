import React, { useEffect } from 'react';
import './GiftAnimation.css';

const SPARKLE_COUNT = 14;

function GiftAnimation({ gift, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="gift-overlay">
      <div className="spotlight" />

      {[...Array(SPARKLE_COUNT)].map((_, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: `${8 + Math.random() * 84}%`,
            animationDelay: `${Math.random() * 2.2}s`,
            fontSize: `${0.8 + Math.random() * 1.4}rem`,
          }}
        >
          {['✨', '💖', '⭐', '💕'][i % 4]}
        </span>
      ))}

      <div className="gift-stage">
        <div className="gift-item">{gift.emoji}</div>
        <div className="gift-ring" />
        <div className="gift-ring ring-2" />
        <div className="pedestal">
          <div className="pedestal-top" />
          <div className="pedestal-base" />
        </div>
      </div>

      <div className="gift-banner">
        <span className="gift-banner-emoji">{gift.emoji}</span>
        <div className="gift-banner-text">
          <strong>{gift.name}</strong>
          <span>-{gift.price} 🪙</span>
        </div>
      </div>
    </div>
  );
}

export default GiftAnimation;
