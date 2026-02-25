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
          height="133"
          viewBox="0 0 180 200"
          style={{ marginBottom: 32 }}
        >
          <defs>
            <linearGradient id="og-fill" x1="90" y1="10" x2="90" y2="190" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1A3660" />
              <stop offset="100%" stopColor="#0C1B30" />
            </linearGradient>
          </defs>
          <path
            d="M90 16 L162 50 L162 120 Q162 160 90 188 Q18 160 18 120 L18 50 Z"
            fill="url(#og-fill)"
            stroke="#00CFFF"
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
          <path
            d="M90 32 L148 58 L148 116 Q148 148 90 172 Q32 148 32 116 L32 58 Z"
            fill="none" stroke="#00CFFF" strokeWidth="0.5" opacity="0.15"
          />
          <circle cx="90" cy="92" r="18" stroke="#00CFFF" strokeWidth="0.6" fill="none" opacity="0.25" />
          <circle cx="90" cy="92" r="32" stroke="#00CFFF" strokeWidth="0.5" fill="none" opacity="0.18" />
          <circle cx="90" cy="92" r="46" stroke="#00CFFF" strokeWidth="0.4" fill="none" opacity="0.12" />
          <line x1="90" y1="52" x2="90" y2="132" stroke="#00CFFF" strokeWidth="0.4" opacity="0.12" />
          <line x1="50" y1="92" x2="130" y2="92" stroke="#00CFFF" strokeWidth="0.4" opacity="0.12" />
          <circle cx="90" cy="92" r="3.5" fill="#00CFFF" opacity="0.95" />
          <circle cx="90" cy="92" r="6" stroke="#00CFFF" strokeWidth="0.6" fill="none" opacity="0.4" />
          <circle cx="108" cy="82" r="2" fill="#00CFFF" opacity="0.7" />
          <circle cx="72" cy="104" r="1.5" fill="#00CFFF" opacity="0.5" />
          <path d="M80 16 L90 10 L100 16" stroke="#00CFFF" strokeWidth="1.2" fill="none" opacity="0.6" />
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
