import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/track', async (req: Request, res: Response) => {
  const { event, roomCode, language, device, referrer } = req.body;
  if (!event) return res.status(400).json({ error: 'event required' });

  void supabase.from('visits').insert({
    event,
    room_code: roomCode ?? null,
    language:  language ?? null,
    device:    device   ?? null,
    referrer:  referrer ?? null,
  }); // fire and forget, never blocks

  res.json({ ok: true });
});

export default router;
