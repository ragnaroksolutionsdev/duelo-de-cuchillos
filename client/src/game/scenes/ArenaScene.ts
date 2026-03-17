import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { BallState, GameStatePayload, GameOverPayload, HitEvent, ARENA } from 'shared/types';
import { playClash, playSplat, playScream } from '../SoundEngine';

const { CX, CY, RADIUS, BALL_RADIUS } = ARENA;
const R    = BALL_RADIUS;
const LERP = 0.18;

type WeaponType = 'sword' | 'knife' | 'scissors' | 'gun';
const WEAPON_TYPES: WeaponType[] = ['sword', 'knife', 'scissors', 'gun'];

interface BallGfx {
  container: Phaser.GameObjects.Container;
  target: { x: number; y: number; heading: number };
  alive: boolean;
  hp: number;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
function weaponFromId(id: string): WeaponType {
  const code = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return WEAPON_TYPES[code % 4];
}

// Each ball gets a unique scream pitch 0.55–1.9 derived from its ID
function screamPitchFromId(id: string): number {
  const code = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 0.55 + ((code * 7) % 100) / 75;
}

function drawWeapon(g: Phaser.GameObjects.Graphics, type: WeaponType) {
  switch (type) {
    case 'sword': {
      g.fillStyle(0xddaa22, 1); g.fillCircle(-3, 0, 4);           // pommel
      g.fillStyle(0x8b5e3c, 1); g.fillRect(-1, -3, R, 6);         // handle
      g.fillStyle(0xaaaaaa, 1); g.fillRect(R - 1, -7, 4, 14);     // crossguard
      g.fillStyle(0xe8e8e8, 1);
      g.fillTriangle(R + 3, -3, R + 3, 3, R + 26, 0);             // blade
      g.fillStyle(0xffffff, 0.5);
      g.fillTriangle(R + 3, -3, R + 26, 0, R + 3, -1);            // highlight
      break;
    }
    case 'knife': {
      g.fillStyle(0x3a2a1a, 1); g.fillRect(-1, -3, R, 6);         // handle
      g.fillStyle(0x888888, 1);
      g.fillCircle(3, 0, 2); g.fillCircle(8, 0, 2);               // rivets
      g.fillRect(R - 1, -5, 3, 10);                                // guard
      g.fillStyle(0xcccccc, 1);
      g.fillTriangle(R + 2, -5, R + 2, 3, R + 17, 0);             // blade
      g.fillStyle(0x888888, 0.7);
      g.fillTriangle(R + 2, -5, R + 2, -2, R + 17, 0);            // spine
      break;
    }
    case 'scissors': {
      g.lineStyle(3, 0xcccccc, 1);
      g.lineBetween(R, -7, R + 15,  5);
      g.lineBetween(R,  7, R + 15, -5);
      g.fillStyle(0x888888, 1);
      g.fillCircle(R - 2, -6, 4); g.fillCircle(R - 2, 6, 4);     // handles
      g.fillStyle(0xffd700, 1); g.fillCircle(R + 5, 0, 2);        // screw
      break;
    }
    case 'gun': {
      g.fillStyle(0x3a2a1a, 1); g.fillRect(R - 2, 1, 8, 9);       // grip
      g.fillStyle(0x444444, 1); g.fillRect(R - 2, -5, 12, 8);     // slide
      g.fillStyle(0x555555, 1); g.fillRect(R + 8, -3, 13, 5);     // barrel
      g.fillStyle(0x111111, 1); g.fillCircle(R + 21, -1, 2);      // muzzle
      g.lineStyle(1.5, 0x666666, 1); g.strokeCircle(R + 3, 5, 4); // trigger guard
      break;
    }
  }
}

export class ArenaScene extends Phaser.Scene {
  private socket!: Socket;
  private teamColors!: string[];
  private myBallId!: string;

  private balls        = new Map<string, BallGfx>();
  private exitedIds    = new Set<string>();
  private bloodLayer!: Phaser.GameObjects.Graphics;

  private _onGameState!: (p: GameStatePayload) => void;
  private _onGameOver!:  (p: GameOverPayload)  => void;

  constructor() { super({ key: 'ArenaScene' }); }

  create() {
    this.socket     = this.registry.get('socket');
    this.teamColors = this.registry.get('teamColors');
    this.myBallId   = this.registry.get('myBallId') ?? '';

    this.drawArena();
    this.bloodLayer = this.add.graphics(); // persistent blood on top of ring

    this._onGameState = (p) => this.onGameState(p);
    this._onGameOver  = (p) => this.onGameOver(p);

    this.socket.on('game_state', this._onGameState);
    this.socket.on('game_over',  this._onGameOver);

    this.events.once('shutdown', this._removeListeners, this);
    this.events.once('destroy',  this._removeListeners, this);
  }

  private _removeListeners() {
    this.socket?.off('game_state', this._onGameState);
    this.socket?.off('game_over',  this._onGameOver);
  }

  // ── Arena ring ──────────────────────────────────────────────
  private drawArena() {
    const g = this.add.graphics();
    g.fillStyle(0x0d0d2b, 1);
    g.fillCircle(CX, CY, RADIUS);
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeCircle(CX, CY, RADIUS);
    g.lineStyle(2, 0x334477, 0.6);
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = Phaser.Math.DegToRad(deg);
      g.lineBetween(CX + Math.cos(rad) * (RADIUS - 14), CY + Math.sin(rad) * (RADIUS - 14),
                    CX + Math.cos(rad) * (RADIUS -  4), CY + Math.sin(rad) * (RADIUS -  4));
    }
    g.lineStyle(1, 0x334466, 0.4);
    g.lineBetween(CX - 20, CY, CX + 20, CY);
    g.lineBetween(CX, CY - 20, CX, CY + 20);
  }

  // ── Blood splash ────────────────────────────────────────────
  private bloodSplash(x: number, y: number, large = false, sound = true) {
    if (sound) playSplat(large ? 0.4 : 0.22);
    const g = this.bloodLayer;
    const n = large ? 10 : 6;
    const maxR = large ? 28 : 16;
    for (let i = 0; i < n; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const dist   = Math.random() * maxR;
      const size   = large ? (3 + Math.random() * 6) : (2 + Math.random() * 4);
      const alpha  = 0.35 + Math.random() * 0.35;
      g.fillStyle(0xaa0000, alpha);
      g.fillCircle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, size);
    }
    // Center splat
    g.fillStyle(0x880000, 0.5);
    g.fillCircle(x, y, large ? 5 : 3);
  }

  // ── Ball spawn ──────────────────────────────────────────────
  private spawnBall(b: BallState) {
    const teamColor = this.teamColors[b.teamIndex] ?? '#ffffff';
    const colorInt  = hexToInt(teamColor);
    const rv = (colorInt >> 16) & 0xff;
    const gv = (colorInt >> 8)  & 0xff;
    const bv =  colorInt        & 0xff;
    const darkInt = ((rv >> 1) << 16) | ((gv >> 1) << 8) | (bv >> 1);

    const container = this.add.container(b.x, b.y);

    const body = this.add.graphics();
    body.fillStyle(colorInt, 1);
    body.fillCircle(0, 0, R);
    body.lineStyle(2, darkInt, 1);
    body.strokeCircle(0, 0, R);

    const eyes = this.add.graphics();
    eyes.fillStyle(0xffffff, 1);
    eyes.fillCircle(-5, -5, 4); eyes.fillCircle(4, -5, 4);
    eyes.fillStyle(0x111111, 1);
    eyes.fillCircle(-4, -5, 2); eyes.fillCircle(5, -5, 2);

    const weaponGfx = this.add.graphics();
    drawWeapon(weaponGfx, weaponFromId(b.id));

    container.add([weaponGfx, body, eyes]);

    if (b.id === this.myBallId) {
      const hl = this.add.graphics();
      hl.lineStyle(2, 0xffffff, 0.7);
      hl.strokeCircle(0, 0, R + 5);
      container.addAt(hl, 0);
    }

    container.setScale(0);
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.Out' });

    this.balls.set(b.id, {
      container,
      target: { x: b.x, y: b.y, heading: b.heading },
      alive: true,
      hp: b.hp,
    });
  }

  // ── Ball exit (knocked out of ring) ─────────────────────────
  private exitBall(id: string, exitX: number, exitY: number, teamColor: string) {
    if (this.exitedIds.has(id)) return;
    this.exitedIds.add(id);

    const gfx = this.balls.get(id);
    if (!gfx) return;
    gfx.alive = false;

    const colorInt = hexToInt(teamColor);

    // 1. Large blood splat on ring edge
    const angle      = Math.atan2(exitY - CY, exitX - CX);
    const ringEdgeX  = CX + Math.cos(angle) * (RADIUS * 0.9);
    const ringEdgeY  = CY + Math.sin(angle) * (RADIUS * 0.9);
    this.bloodSplash(ringEdgeX, ringEdgeY, true);

    // 2. Shockwave ring at exit point
    const wave = this.add.graphics();
    wave.lineStyle(4, colorInt, 0.9);
    wave.strokeCircle(exitX, exitY, R);
    this.tweens.add({
      targets: wave, scaleX: 5, scaleY: 5, alpha: 0,
      duration: 500, ease: 'Cubic.Out',
      onComplete: () => wave.destroy(),
    });

    // 3. Ball shrinks + flies further out + fades
    const outX = exitX + Math.cos(angle) * 80;
    const outY = exitY + Math.sin(angle) * 80;
    this.tweens.add({
      targets: gfx.container,
      x: outX, y: outY,
      scaleX: 0, scaleY: 0,
      angle: 360,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.In',
      onComplete: () => {
        gfx.container.destroy();
        this.balls.delete(id);
      },
    });

    // 4. Debris particles (small colored circles flying out)
    for (let i = 0; i < 6; i++) {
      const spread  = (Math.random() - 0.5) * Math.PI * 0.8;
      const pAngle  = angle + spread;
      const speed   = 40 + Math.random() * 60;
      const px = exitX;
      const py = exitY;
      const debris = this.add.graphics();
      debris.fillStyle(colorInt, 0.9);
      debris.fillCircle(0, 0, 3 + Math.random() * 4);
      debris.x = px; debris.y = py;
      this.tweens.add({
        targets: debris,
        x: px + Math.cos(pAngle) * speed,
        y: py + Math.sin(pAngle) * speed,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => debris.destroy(),
      });
    }
  }

  // ── Socket handlers ─────────────────────────────────────────
  private onGameState(payload: GameStatePayload) {
    if (!this.scene?.isActive('ArenaScene')) return;

    // Draw blood splashes + clash sound for hits this tick
    for (const hit of payload.hits ?? []) {
      this.bloodSplash(hit.x, hit.y);
      playClash();
    }

    for (const b of payload.balls) {
      const existing = this.balls.get(b.id);

      if (!b.alive) {
        if (existing && existing.alive) {
          // Just died — play exit animation + scream
          const teamColor = this.teamColors[b.teamIndex] ?? '#ffffff';
          this.exitBall(b.id, b.x, b.y, teamColor);
          playScream(screamPitchFromId(b.id));
        }
        continue;
      }

      if (!existing) {
        this.spawnBall(b);
      } else {
        existing.target = { x: b.x, y: b.y, heading: b.heading };

        // Flash red tint on damage
        if (b.hp < existing.hp) {
          this.tweens.add({
            targets: existing.container,
            alpha: 0.4,
            duration: 60,
            yoyo: true,
            repeat: 1,
          });
        }
        existing.hp = b.hp;
      }
    }
  }

  private onGameOver(payload: GameOverPayload) {
    if (!this.scene?.isActive('ArenaScene')) return;

    const winnerColor = payload.winnerTeamIndex >= 0
      ? (this.teamColors[payload.winnerTeamIndex] ?? '#ffffff')
      : '#FFD700';
    const colorInt = hexToInt(winnerColor);

    const flashGfx = this.add.graphics();
    flashGfx.lineStyle(8, colorInt, 0.8);
    flashGfx.strokeCircle(CX, CY, RADIUS);
    this.tweens.add({ targets: flashGfx, alpha: 0, duration: 800, yoyo: true, repeat: 2 });

    const winner = payload.winnerTeamIndex >= 0 ? payload.winnerAnswer : '¡Empate!';
    this.add.text(CX, CY - 30, '🏆', { fontSize: '52px' }).setOrigin(0.5).setAlpha(0);
    const label = this.add.text(CX, CY + 40, winner, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: winnerColor,
      wordWrap: { width: 480 },
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [label], alpha: 1, duration: 700, ease: 'Cubic.Out' });
  }

  // ── Phaser update ────────────────────────────────────────────
  update() {
    for (const [, gfx] of this.balls) {
      if (!gfx.alive) continue;
      const c = gfx.container;
      c.x += (gfx.target.x - c.x) * LERP;
      c.y += (gfx.target.y - c.y) * LERP;
      const dRot = gfx.target.heading - c.rotation;
      c.rotation += Math.atan2(Math.sin(dRot), Math.cos(dRot)) * LERP;
    }
  }

  destroy() { this._removeListeners(); }
}
