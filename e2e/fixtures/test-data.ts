export const USERS = {
  admin: {
    email: 'admin@soc.local',
    password: 'Password123!',
    name: 'System Administrator',
    role: 'ADMIN' as const,
    defaultRoute: '/users',
  },
  trainer: {
    email: 'trainer@soc.local',
    password: 'Password123!',
    name: 'Lead Trainer',
    role: 'TRAINER' as const,
    defaultRoute: '/console',
  },
  trainee: {
    email: 'trainee@soc.local',
    password: 'Password123!',
    name: 'SOC Analyst Trainee',
    role: 'TRAINEE' as const,
    defaultRoute: '/dashboard',
  },
};

export const BASE_URL = process.env.E2E_BASE_URL || 'https://client-production-4081.up.railway.app';
export const API_URL = process.env.E2E_API_URL || 'https://server-production-35c2.up.railway.app';

export const SCENARIOS = {
  phishing: {
    name: 'Phishing to PowerShell Execution',
    difficulty: 'BEGINNER',
    category: 'Email Threats',
  },
};
