import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-navy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A3660" />
          <stop offset="100%" stopColor="#0C1B30" />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path
        d="M32 4 L56 16 V34 C56 48 44 58 32 62 C20 58 8 48 8 34 V16 Z"
        fill="url(#logo-navy)"
        stroke="#00CFFF"
        strokeWidth="1.5"
        strokeOpacity="0.5"
      />
      {/* Radar arcs */}
      <path d="M32 30 A10 10 0 0 1 42 30" fill="none" stroke="#00CFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 30 A16 16 0 0 1 48 30" fill="none" stroke="#00CFFF" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M32 30 A22 22 0 0 1 54 30" fill="none" stroke="#00CFFF" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3" />
      {/* Radar sweep line */}
      <line x1="32" y1="30" x2="46" y2="20" stroke="#00CFFF" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="32" cy="30" r="3" fill="#00CFFF" />
    </svg>
  );
}
