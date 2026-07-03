import React, { useState, useEffect } from 'react';
import { storeAPI } from '../api';
import './Store.css';

// Apple logo drawn inline so it renders on every platform
function AppleLogo() {
  return (
    <svg className="apple-logo" viewBox="0 0 170 200" aria-hidden="true">
      <path
        d="M150.4 69.2c-1.1.9-20.7 11.9-20.7 36.5 0 28.4 24.9 38.5 25.7 38.7-.1.6-4 13.8-13.1 27.3-8.2 11.9-16.7 23.7-29.7 23.7s-16.3-7.5-31.3-7.5c-14.6 0-19.8 7.8-31.7 7.8s-20.2-11-29.7-24.5C9 155.3 0 130.4 0 106.8 0 68.9 24.6 48.8 48.9 48.8c12.9 0 23.6 8.5 31.7 8.5 7.7 0 19.7-9 34.4-9 5.5 0 25.5.5 35.4 20.9zM108 33.7c6-7.1 10.2-17 10.2-26.9 0-1.4-.1-2.8-.4-3.9-9.7.4-21.3 6.5-28.3 14.6-5.5 6.2-10.6 16.1-10.6 26.1 0 1.5.3 3 .4 3.5.6.1 1.6.2 2.6.2 8.7 0 19.7-5.8 26.1-13.6z"
        fill="currentColor"
      />
    </svg>
  );
}

function Store({ onCoinsChange }) {
  const [packages, setPackages] = useState([]);
  const [demoMode, setDemoMode] = useState(true);
  const [paying, setPaying] = useState(null); // package being purchased
  const [payState, setPayState] = useState('idle'); // idle | sheet | processing | done
  const [credited, setCredited] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    storeAPI.packages()
      .then((r) => {
        setPackages(r.data.packages);
        setDemoMode(r.data.demoMode);
      })
      .catch(() => setError('Could not load the store'));

    // Handle return from a real Stripe Checkout redirect
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('purchase') === 'success' && sessionId) {
      window.history.replaceState({}, '', '/');
      storeAPI.verify(sessionId)
        .then((r) => {
          setCredited(r.data.credited);
          setPayState('done');
          onCoinsChange?.(r.data.coins);
          setTimeout(() => setPayState('idle'), 3200);
        })
        .catch(() => setError('Could not verify your payment — contact support'));
    }
  }, [onCoinsChange]);

  const buy = async (pack) => {
    if (payState !== 'idle') return;
    setError('');
    setPaying(pack);
    setPayState('sheet');
  };

  const confirmPay = async () => {
    setPayState('processing');
    try {
      const r = await storeAPI.purchase(paying.id);
      if (r.data.checkoutUrl) {
        // Real Stripe Checkout (Apple Pay shows automatically in Safari)
        window.location.href = r.data.checkoutUrl;
        return;
      }
      // Demo mode success
      setCredited(r.data.credited);
      onCoinsChange?.(r.data.coins);
      setTimeout(() => {
        setPayState('done');
        setTimeout(() => { setPayState('idle'); setPaying(null); }, 2800);
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Purchase failed');
      setPayState('idle');
      setPaying(null);
    }
  };

  const cancelPay = () => {
    if (payState === 'sheet') { setPayState('idle'); setPaying(null); }
  };

  return (
    <div className="store-container">
      <div className="store-head">
        <h2>🪙 Coin Store</h2>
        <p>Top up and spoil her rotten.</p>
        {demoMode && (
          <div className="demo-banner">
            Demo mode — purchases are free and instant. Add a Stripe key to
            <code> backend/.env</code> to charge real money with Apple Pay.
          </div>
        )}
      </div>

      {error && <div className="store-error">{error}</div>}

      <div className="packages">
        {packages.map((p) => (
          <div key={p.id} className={`package ${p.tag ? 'tagged' : ''}`}>
            {p.tag && <span className="pack-tag">{p.tag}</span>}
            <span className="pack-emoji">{p.emoji}</span>
            <span className="pack-name">{p.label}</span>
            <span className="pack-coins">
              {p.coins.toLocaleString()} 🪙
              {p.bonus > 0 && <em className="pack-bonus">+{p.bonus} bonus</em>}
            </span>
            <button className="applepay-btn" onClick={() => buy(p)}>
              <AppleLogo /> Pay&nbsp;·&nbsp;${(p.priceCents / 100).toFixed(2)}
            </button>
          </div>
        ))}
      </div>

      {/* Apple Pay style payment sheet */}
      {payState !== 'idle' && paying && (
        <div className="pay-backdrop" onClick={cancelPay}>
          <div className="pay-sheet" onClick={(e) => e.stopPropagation()}>
            {payState === 'sheet' && (
              <>
                <div className="sheet-grabber" />
                <div className="sheet-title"><AppleLogo /> Pay</div>
                <div className="sheet-row">
                  <span>{paying.emoji} {paying.label}</span>
                  <span>{(paying.coins + paying.bonus).toLocaleString()} coins</span>
                </div>
                <div className="sheet-row total">
                  <span>Total</span>
                  <span>${(paying.priceCents / 100).toFixed(2)}</span>
                </div>
                <button className="sheet-confirm" onClick={confirmPay}>
                  {demoMode ? 'Confirm (Demo — no charge)' : 'Continue to payment'}
                </button>
                <button className="sheet-cancel" onClick={cancelPay}>Cancel</button>
              </>
            )}

            {payState === 'processing' && (
              <div className="sheet-status">
                <div className="pay-spinner" />
                <p>Processing…</p>
              </div>
            )}

            {payState === 'done' && (
              <div className="sheet-status">
                <div className="pay-check">✓</div>
                <p className="pay-done-text">+{credited.toLocaleString()} 🪙 added!</p>
                <div className="coin-rain" aria-hidden="true">
                  {[...Array(10)].map((_, i) => (
                    <span key={i} style={{ left: `${5 + i * 10}%`, animationDelay: `${i * 0.12}s` }}>🪙</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Store;
