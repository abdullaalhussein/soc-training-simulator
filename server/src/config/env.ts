import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '4h',
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  SERVER_PORT: parseInt(process.env.PORT || process.env.SERVER_PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
};

// Validate JWT secrets
const isProduction = env.NODE_ENV === 'production';

if (env.JWT_SECRET.includes('change-in-production') || env.JWT_SECRET.length < 32) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be at least 32 characters and not a placeholder value');
  } else {
    console.warn('WARNING: JWT_SECRET is a placeholder or too short. Set a strong secret before deploying to production.');
  }
}

if (!env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set. AI-powered scoring, assistant, and scenario generation will be disabled.');
}

if (env.JWT_REFRESH_SECRET.includes('change-in-production') || env.JWT_REFRESH_SECRET.length < 32) {
  if (isProduction) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters and not a placeholder value');
  } else {
    console.warn('WARNING: JWT_REFRESH_SECRET is a placeholder or too short. Set a strong secret before deploying to production.');
  }
}
