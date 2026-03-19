const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

function device(): 'mobile' | 'desktop' {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

export function track(event: string, roomCode?: string) {
  fetch(`${SERVER}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      roomCode: roomCode ?? null,
      language: navigator.language,
      device: device(),
      referrer: document.referrer || 'direct',
    }),
  }).catch(() => {}); // fire and forget — never blocks the UI
}
