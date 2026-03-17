import 'dotenv/config';

export const PORT = parseInt(process.env.PORT ?? '3001', 10);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

export const TICK_RATE = 30; // ticks per second
export const TICK_MS = Math.round(1000 / TICK_RATE);
