import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SOC Training Simulator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0C1B30 0%, #1A3660 50%, #0C1B30 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand shield icon */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 64 64"
          style={{ marginBottom: 32 }}
        >
          <defs>
            <linearGradient id="og-navy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A3660" />
              <stop offset="100%" stopColor="#0C1B30" />
            </linearGradient>
          </defs>
          <path
            d="M32 4 L56 16 V34 C56 48 44 58 32 62 C20 58 8 48 8 34 V16 Z"
            fill="url(#og-navy)"
            stroke="#00CFFF"
            strokeWidth="1.5"
          />
          <path d="M32 30 A10 10 0 0 1 42 30" fill="none" stroke="#00CFFF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 30 A16 16 0 0 1 48 30" fill="none" stroke="#00CFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M32 30 A22 22 0 0 1 54 30" fill="none" stroke="#00CFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          <line x1="32" y1="30" x2="46" y2="20" stroke="#00CFFF" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="32" cy="30" r="3" fill="#00CFFF" />
        </svg>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          SOC Training Simulator
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#94a3b8',
            maxWidth: 700,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Hands-on cybersecurity training with realistic simulated logs
        </div>
        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #00CFFF, #1A3660, #00CFFF)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
