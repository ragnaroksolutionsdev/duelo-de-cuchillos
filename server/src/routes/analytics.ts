import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

async function getCountry(ip: string): Promise<string | null> {
  try {
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      console.log('[analytics] local IP, skipping geo:', ip);
      return null;
    }
    console.log('[analytics] looking up country for IP:', ip);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) { console.log('[analytics] ip-api error:', res.status); return null; }
    const data = await res.json() as { countryCode?: string };
    console.log('[analytics] country result:', data);
    return data.countryCode ?? null;
  } catch (e) {
    console.error('[analytics] getCountry error:', e);
    return null;
  }
}

router.post('/track', async (req: Request, res: Response) => {
  const { event, roomCode, language, device, referrer } = req.body;
  if (!event) return res.status(400).json({ error: 'event required' });

  // Respond immediately, resolve country in background
  res.json({ ok: true });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
  const country = await getCountry(ip);

  supabase.from('visits').insert({
    event,
    room_code: roomCode ?? null,
    language:  language ?? null,
    device:    device   ?? null,
    referrer:  referrer ?? null,
    country,
  }).then(({ error }) => {
    if (error) console.error('[analytics] insert error:', error.message, error.details);
  });
});

export default router;
