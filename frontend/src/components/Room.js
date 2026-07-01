import React, { useMemo } from 'react';
import './Room.css';

const PARTICLES = {
  pink: ['💕', '💖', '✨', '🌸'],
  red: ['❤️', '🔥', '✨', '🌹'],
  space: ['💫', '⭐', '🪐', '✨'],
};

function Room({ theme, gfName }) {
  // Stable random positions per theme so particles don't jump on re-render
  const particles = useMemo(
    () =>
      [...Array(10)].map((_, i) => ({
        emoji: PARTICLES[theme][i % PARTICLES[theme].length],
        left: `${Math.random() * 94}%`,
        duration: `${7 + Math.random() * 8}s`,
        delay: `${Math.random() * 9}s`,
        size: `${0.7 + Math.random() * 0.9}rem`,
      })),
    [theme]
  );

  const stars = useMemo(
    () =>
      theme === 'space'
        ? [...Array(40)].map(() => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 70}%`,
            duration: `${1.5 + Math.random() * 3}s`,
            delay: `${Math.random() * 3}s`,
          }))
        : [],
    [theme]
  );

  return (
    <div className={`room room-${theme}`}>
      <div className="room-back" />
      <div className="room-glow" />
      <div className="room-wall-left" />
      <div className="room-wall-right" />
      <div className="room-floor" />

      {stars.map((s, i) => (
        <span
          key={`star-${i}`}
          className="room-star"
          style={{ left: s.left, top: s.top, animationDuration: s.duration, animationDelay: s.delay }}
        />
      ))}

      {particles.map((p, i) => (
        <span
          key={`p-${i}`}
          className="room-particle"
          style={{
            left: p.left,
            fontSize: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        >
          {p.emoji}
        </span>
      ))}

      <div className="room-avatar">
        <div className="room-avatar-orb">😘</div>
        <div className="room-avatar-name">{gfName}</div>
      </div>
    </div>
  );
}

export default Room;
