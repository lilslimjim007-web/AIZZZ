import React from 'react';

// Animated girlfriend character - hair/dress colors come from the room theme CSS vars
function Girl({ kissing }) {
  return (
    <svg
      className={`girl ${kissing ? 'kiss' : ''}`}
      viewBox="0 0 200 268"
      role="img"
      aria-label="Your girlfriend"
    >
      <defs>
        <linearGradient id="hairG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--hair-1, #ff8fc7)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hair-2, #cf217e)' }} />
        </linearGradient>
        <linearGradient id="dressG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--dress-1, #ff2d95)' }} />
          <stop offset="1" style={{ stopColor: 'var(--dress-2, #5b0c44)' }} />
        </linearGradient>
      </defs>
      <g className="hair-sway">
        <path
          d="M100 14 C52 14 34 58 37 112 C39 162 30 200 47 232 C62 244 138 244 153 232 C170 200 161 162 163 112 C166 58 148 14 100 14 Z"
          fill="url(#hairG)"
        />
      </g>
      <path
        d="M100 148 C78 148 64 172 60 202 C56 234 72 256 100 256 C128 256 144 234 140 202 C136 172 122 148 100 148 Z"
        fill="url(#dressG)"
      />
      <path d="M78 196 Q100 208 122 196" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <circle cx="100" cy="222" r="3" fill="rgba(255,255,255,0.45)" />
      <path d="M92 128 h16 v20 c0 7 -16 7 -16 0 Z" fill="#ffd9c4" />
      <ellipse cx="100" cy="94" rx="45" ry="47" fill="#ffd9c4" />
      <ellipse cx="70" cy="112" rx="9" ry="5" fill="#ff7fae" opacity="0.5" />
      <ellipse cx="130" cy="112" rx="9" ry="5" fill="#ff7fae" opacity="0.5" />
      <g className="eye eye-l">
        <ellipse cx="79" cy="100" rx="7.5" ry="10.5" fill="#2a1030" />
        <circle cx="82" cy="96" r="2.6" fill="#fff" />
      </g>
      <g className="eye eye-r">
        <ellipse cx="121" cy="100" rx="7.5" ry="10.5" fill="#2a1030" />
        <circle cx="124" cy="96" r="2.6" fill="#fff" />
      </g>
      <path d="M69 85 Q79 79 89 85" fill="none" stroke="#5a2340" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M111 85 Q121 79 131 85" fill="none" stroke="#5a2340" strokeWidth="2.4" strokeLinecap="round" />
      <path className="mouth" d="M92 120 Q100 128 108 120" fill="none" stroke="#c2496f" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M100 40 C62 40 51 74 55 96 C61 82 68 73 77 74 C72 84 74 91 79 96 C85 82 94 70 100 67 C106 70 115 82 121 96 C126 91 128 84 123 74 C132 73 139 82 145 96 C149 74 138 40 100 40 Z"
        fill="url(#hairG)"
      />
      <path className="hair-sway" d="M55 96 C47 138 50 184 62 218 C69 204 66 160 64 126 Z" fill="url(#hairG)" opacity="0.92" />
      <path className="hair-sway" d="M145 96 C153 138 150 184 138 218 C131 204 134 160 136 126 Z" fill="url(#hairG)" opacity="0.92" />
      <path
        className="kiss-heart"
        d="M113 116 c-2.4 -2.6 -7 -0.6 -7 2.6 c0 2.8 4 5.4 7 7.4 c3 -2 7 -4.6 7 -7.4 c0 -3.2 -4.6 -5.2 -7 -2.6 Z"
        fill="#ff3d7f"
      />
    </svg>
  );
}

export default Girl;
