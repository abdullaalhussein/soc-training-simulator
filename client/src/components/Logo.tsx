import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 200"
      width={size}
      height={size * (200 / 180)}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <style>{`
          @keyframes logoPulseRing {
            0% { r: 28; opacity: 0.5; }
            100% { r: 52; opacity: 0; }
          }
          @keyframes logoRadarSweep {
            0% { opacity: 0.6; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.6; transform: scale(0.92); }
          }
          .logo-pulse-ring {
            animation: logoPulseRing 3s ease-out infinite;
          }
          .logo-pulse-ring-delayed {
            animation: logoPulseRing 3s ease-out 1.5s infinite;
          }
          .logo-radar-glow {
            animation: logoRadarSweep 4s ease-in-out infinite;
            transform-origin: 90px 92px;
          }
        `}</style>
        <linearGradient id="logo-fill" x1="90" y1="10" x2="90" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1A3660" />
          <stop offset="100%" stopColor="#0C1B30" />
        </linearGradient>
        <linearGradient id="logo-stroke" x1="90" y1="10" x2="90" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#00CFFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00CFFF" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="logo-glow" cx="90" cy="92" r="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00CFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="logo-sweep" x1="90" y1="52" x2="130" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00CFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="logo-clip">
          <path d="M90 16 L162 50 L162 120 Q162 160 90 188 Q18 160 18 120 L18 50 Z" />
        </clipPath>
      </defs>

      {/* Shield body */}
      <path
        d="M90 16 L162 50 L162 120 Q162 160 90 188 Q18 160 18 120 L18 50 Z"
        fill="url(#logo-fill)"
        stroke="url(#logo-stroke)"
        strokeWidth="1.5"
      />

      {/* Inner shield outline */}
      <path
        d="M90 32 L148 58 L148 116 Q148 148 90 172 Q32 148 32 116 L32 58 Z"
        fill="none"
        stroke="#00CFFF"
        strokeWidth="0.5"
        opacity="0.15"
      />

      {/* Radar elements — clipped to shield */}
      <g clipPath="url(#logo-clip)">
        {/* Core glow */}
        <circle cx="90" cy="92" r="40" fill="url(#logo-glow)" />

        {/* Concentric radar rings */}
        <circle cx="90" cy="92" r="18" stroke="#00CFFF" strokeWidth="0.6" fill="none" opacity="0.25" />
        <circle cx="90" cy="92" r="32" stroke="#00CFFF" strokeWidth="0.5" fill="none" opacity="0.18" />
        <circle cx="90" cy="92" r="46" stroke="#00CFFF" strokeWidth="0.4" fill="none" opacity="0.12" />
        <circle cx="90" cy="92" r="60" stroke="#00CFFF" strokeWidth="0.35" fill="none" opacity="0.08" />

        {/* Crosshair lines */}
        <line x1="90" y1="52" x2="90" y2="132" stroke="#00CFFF" strokeWidth="0.4" opacity="0.12" />
        <line x1="50" y1="92" x2="130" y2="92" stroke="#00CFFF" strokeWidth="0.4" opacity="0.12" />

        {/* Radar sweep wedge — animated breathing */}
        <g transform="rotate(-30, 90, 92)" className="logo-radar-glow">
          <path d="M90 92 L90 52 A40 40 0 0 1 124.6 72 Z" fill="url(#logo-sweep)" />
        </g>

        {/* Animated pulse rings */}
        <circle cx="90" cy="92" r="28" stroke="#00CFFF" strokeWidth="0.8" fill="none" className="logo-pulse-ring" />
        <circle cx="90" cy="92" r="28" stroke="#00CFFF" strokeWidth="0.6" fill="none" className="logo-pulse-ring-delayed" />

        {/* Center dot + glow ring */}
        <circle cx="90" cy="92" r="3.5" fill="#00CFFF" opacity="0.95" />
        <circle cx="90" cy="92" r="6" stroke="#00CFFF" strokeWidth="0.6" fill="none" opacity="0.4" />

        {/* Threat blips */}
        <circle cx="108" cy="82" r="2" fill="#00CFFF" opacity="0.7" />
        <circle cx="72" cy="104" r="1.5" fill="#00CFFF" opacity="0.5" />
        <circle cx="102" cy="108" r="1.5" fill="#00CFFF" opacity="0.45" />
        <circle cx="62" cy="78" r="1.2" fill="#4DE0FF" opacity="0.35" />
        <circle cx="118" cy="96" r="1.2" fill="#4DE0FF" opacity="0.3" />
      </g>

      {/* Top shield accent notch */}
      <path d="M80 16 L90 10 L100 16" stroke="#00CFFF" strokeWidth="1.2" fill="none" opacity="0.6" />
    </svg>
  );
}
