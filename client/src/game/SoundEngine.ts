/**
 * Procedural sound engine — no audio files needed.
 * All sounds synthesized with Web Audio API.
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Helpers ──────────────────────────────────────────────────

function masterGain(vol: number): GainNode {
  const g = ctx().createGain();
  g.gain.value = vol;
  g.connect(ctx().destination);
  return g;
}

function noiseBuffer(durationSec: number): AudioBuffer {
  const c      = ctx();
  const frames = Math.floor(c.sampleRate * durationSec);
  const buf    = c.createBuffer(1, frames, c.sampleRate);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Sword / weapon clash ──────────────────────────────────────
export function playClash(vol = 0.55) {
  const c   = ctx();
  const now = c.currentTime;
  const out = masterGain(vol);

  // 1. Sharp impact: wide-band noise burst (the "smack")
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = noiseBuffer(0.05);
  const noiseHpf = c.createBiquadFilter();
  noiseHpf.type = 'highpass';
  noiseHpf.frequency.value = 1800;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(2.0, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  noiseSrc.connect(noiseHpf); noiseHpf.connect(noiseGain); noiseGain.connect(out);
  noiseSrc.start(now);

  // 2. Metallic ring: triangle waves at high frequencies (cleaner than sawtooth)
  const freqs = [
    1400 + Math.random() * 300,
    2200 + Math.random() * 400,
    3500 + Math.random() * 500,
  ];
  for (const freq of freqs) {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.45);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain); gain.connect(out);
    osc.start(now); osc.stop(now + 0.45);
  }

  // 3. Low body thud
  const thud = c.createBufferSource();
  thud.buffer = noiseBuffer(0.04);
  const thudLpf = c.createBiquadFilter();
  thudLpf.type = 'lowpass';
  thudLpf.frequency.value = 180;
  const thudGain = c.createGain();
  thudGain.gain.setValueAtTime(1.2, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  thud.connect(thudLpf); thudLpf.connect(thudGain); thudGain.connect(out);
  thud.start(now);
}

// ── Blood splatter (wet, squelchy) ───────────────────────────
export function playSplat(vol = 0.3) {
  const c   = ctx();
  const now = c.currentTime;
  const out = masterGain(vol);

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.12);

  // Low-pass → wet thud
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(600, now);
  lpf.frequency.exponentialRampToValueAtTime(80, now + 0.12);

  const gain = c.createGain();
  gain.gain.setValueAtTime(1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  src.connect(lpf); lpf.connect(gain); gain.connect(out);
  src.start(now);

  // Tiny pitched "splitch" overtone
  const osc  = c.createOscillator();
  const og   = c.createGain();
  osc.type   = 'sine';
  osc.frequency.setValueAtTime(120 + Math.random() * 60, now);
  og.gain.setValueAtTime(0.4, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(og); og.connect(out);
  osc.start(now); osc.stop(now + 0.08);
}

// ── Death scream — sharp yelp + falling pitch ─────────────────
// pitch: 0.5 (deep) → 2.0 (high squeaky)
export function playScream(pitch = 1.0, vol = 0.6) {
  const c   = ctx();
  const now = c.currentTime;
  const dur = 0.35 + Math.random() * 0.2; // 0.35–0.55s (shorter = snappier)
  const out = masterGain(vol);

  const baseHz = (500 + Math.random() * 150) * pitch; // higher start for urgency

  // Main voice: sawtooth swept steeply down
  const osc = c.createOscillator();
  osc.type  = 'sawtooth';
  osc.frequency.setValueAtTime(baseHz, now);
  osc.frequency.exponentialRampToValueAtTime(baseHz * 0.15, now + dur); // steeper fall

  // Vibrato (panic wobble)
  const vibOsc  = c.createOscillator();
  const vibGain = c.createGain();
  vibOsc.frequency.value = 14 + Math.random() * 6; // faster wobble
  vibGain.gain.setValueAtTime(baseHz * 0.06, now);
  vibGain.gain.linearRampToValueAtTime(0, now + dur);
  vibOsc.connect(vibGain);
  vibGain.connect(osc.frequency);

  // Two formant filters layered for a richer yell
  const f1 = c.createBiquadFilter();
  f1.type = 'bandpass'; f1.Q.value = 3;
  f1.frequency.setValueAtTime(baseHz * 2, now);
  f1.frequency.exponentialRampToValueAtTime(baseHz * 0.6, now + dur);

  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass'; f2.Q.value = 1.5;
  f2.frequency.setValueAtTime(baseHz * 0.8, now);
  f2.frequency.exponentialRampToValueAtTime(baseHz * 0.3, now + dur);

  // Amplitude: sharp attack, hold briefly, fast fade
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1.0, now + 0.01);   // instant attack
  gain.gain.setValueAtTime(1.0, now + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  // Mix: osc → f1 → gain, osc → f2 → gain
  osc.connect(f1); f1.connect(gain); gain.connect(out);
  osc.connect(f2); f2.connect(gain);

  vibOsc.start(now); osc.start(now);
  vibOsc.stop(now + dur); osc.stop(now + dur);
}

// ── Countdown beep ───────────────────────────────────────────
export function playBeep(freq = 440, vol = 0.2) {
  const c   = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type  = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g); g.connect(c.destination);
  osc.start(now); osc.stop(now + 0.15);
}
