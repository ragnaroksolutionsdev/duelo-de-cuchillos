import { ARENA, HitEvent } from '../../../shared/types';

const { CX, CY, RADIUS, BALL_RADIUS } = ARENA;

const MAX_SPEED     = 6.0;
const BALL_HP       = 3;
const EXIT_DIST     = RADIUS + 60;
const WANDER_FORCE  = 0.03; // constant random noise so balls never lock to one axis

export interface BallStats {
  seekForce:   number; // 0.04 – 0.10  how aggressively it hunts
  cruiseSpeed: number; // 1.4 – 2.6    normal travel cap
  mass:        number; // 0.7 – 1.3    affects knockback received (lighter = farther)
}

export interface Ball {
  id: string;
  teamIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  alive: boolean;
  hp: number;
  hitCooldown: number;
  stats: BallStats;
}

export interface TickResult {
  balls: Ball[];
  hits: HitEvent[];
}

function rnd(min: number, max: number) { return min + Math.random() * (max - min); }

export function createBall(id: string, teamIndex: number, spawnAngle: number): Ball {
  const r = RADIUS * 0.55;
  const x = CX + Math.cos(spawnAngle) * r;
  const y = CY + Math.sin(spawnAngle) * r;
  const toCenter = Math.atan2(CY - y, CX - x);
  const spread   = (Math.random() - 0.5) * Math.PI * 0.6;
  const angle    = toCenter + spread;

  // Each ball is unique — vary speed, aggression, and mass
  const stats: BallStats = {
    seekForce:   rnd(0.04, 0.10),
    cruiseSpeed: rnd(1.4,  2.6),
    mass:        rnd(0.7,  1.3),
  };

  const speed = rnd(stats.cruiseSpeed * 0.8, stats.cruiseSpeed * 1.1);
  return {
    id, teamIndex, x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    heading: angle,
    alive: true,
    hp: BALL_HP,
    hitCooldown: 0,
    stats,
  };
}

export function tick(balls: Ball[], suddenDeathLevel = 0, ringRadius: number = RADIUS): TickResult {
  const alive = balls.filter(b => b.alive);
  const hits: HitEvent[] = [];

  // Decrement cooldowns
  for (const b of alive) {
    if (b.hitCooldown > 0) b.hitCooldown--;
  }

  // 1. Seek + wander — each level adds +1 multiplier to force and speed
  for (const b of alive) {
    const mult        = 1 + suddenDeathLevel;
    const seekForce   = b.stats.seekForce   * mult;
    const cruiseSpeed = b.stats.cruiseSpeed * mult;
    const spd = Math.hypot(b.vx, b.vy);

    // Wander: small random nudge every tick — prevents axis-locking
    b.vx += (Math.random() - 0.5) * WANDER_FORCE * 2;
    b.vy += (Math.random() - 0.5) * WANDER_FORCE * 2;

    // Only seek when not flying from a knockback
    if (spd <= cruiseSpeed * 1.8) {
      let nearestDist = Infinity;
      let nearestEnemy: Ball | null = null;
      for (const other of alive) {
        if (other.teamIndex === b.teamIndex) continue;
        const d = Math.hypot(other.x - b.x, other.y - b.y);
        if (d < nearestDist) { nearestDist = d; nearestEnemy = other; }
      }
      if (nearestEnemy) {
        const dx = nearestEnemy.x - b.x;
        const dy = nearestEnemy.y - b.y;
        b.vx += (dx / nearestDist) * seekForce;
        b.vy += (dy / nearestDist) * seekForce;
      }
    }

    // Cruise speed cap (only when not post-knockback)
    if (spd > 0 && spd <= cruiseSpeed * 1.8) {
      const cap = Math.max(cruiseSpeed, spd * 0.98); // gentle deceleration
      if (spd > cap) { b.vx = (b.vx / spd) * cap; b.vy = (b.vy / spd) * cap; }
    }
  }

  // 2. Move all balls
  for (const b of alive) {
    b.x += b.vx;
    b.y += b.vy;

    // Friction (gradual slowdown after knockback)
    b.vx *= 0.985;
    b.vy *= 0.985;

    const dx   = b.x - CX;
    const dy   = b.y - CY;
    const dist = Math.hypot(dx, dy);

    // Exit ring → ball is eliminated (use dynamic ring + fixed exit buffer)
    const exitDist = ringRadius + 60;
    if (dist > exitDist) {
      b.alive = false;
      continue;
    }

    // Boundary bounce — only if HP > 0; hp=0 → exits immediately
    const maxDist = ringRadius - BALL_RADIUS;
    if (dist > maxDist) {
      if (b.hp > 0) {
        const nx  = dx / dist;
        const ny  = dy / dist;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx * 0.75; // 75% restitution (loses energy)
        b.vy -= 2 * dot * ny * 0.75;
        b.x = CX + nx * maxDist;
        b.y = CY + ny * maxDist;
      } else {
        // hp = 0 and outside ring → eliminate immediately, no re-entry
        b.alive = false;
        continue;
      }
    }

    // Cap absolute speed
    const spd = Math.hypot(b.vx, b.vy);
    if (spd > MAX_SPEED) {
      b.vx = (b.vx / spd) * MAX_SPEED;
      b.vy = (b.vy / spd) * MAX_SPEED;
    }

    if (Math.abs(b.vx) > 0.01 || Math.abs(b.vy) > 0.01) {
      b.heading = Math.atan2(b.vy, b.vx);
    }
  }

  // 3. Pairwise collisions
  const stillAlive = balls.filter(b => b.alive);
  for (let i = 0; i < stillAlive.length; i++) {
    for (let j = i + 1; j < stillAlive.length; j++) {
      const a = stillAlive[i];
      const b = stillAlive[j];
      if (!a.alive || !b.alive) continue;

      const dx   = b.x - a.x;
      const dy   = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minD = BALL_RADIUS * 2;
      if (dist >= minD || dist === 0) continue;

      // Separate overlapping balls
      const nx      = dx / dist;
      const ny      = dy / dist;
      const overlap = (minD - dist) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;

      if (a.teamIndex === b.teamIndex) {
        // Same team: elastic push (no damage)
        const rvx  = a.vx - b.vx;
        const rvy  = a.vy - b.vy;
        const dvn  = rvx * nx + rvy * ny;
        if (dvn < 0) {
          a.vx -= dvn * nx; a.vy -= dvn * ny;
          b.vx += dvn * nx; b.vy += dvn * ny;
        }
      } else {
        // Enemy: knockback + damage
        if (a.hitCooldown === 0 && b.hitCooldown === 0) {
          const baseA = Math.atan2(-ny, -nx);
          const baseB = Math.atan2( ny,  nx);

          const spreadA = (Math.random() - 0.5) * Math.PI * 0.9;
          const spreadB = (Math.random() - 0.5) * Math.PI * 0.9;

          // Knockback scales with sudden death level — more chaos each level
          const kbMult = 1 + suddenDeathLevel * 1.2;
          const kbA = rnd(3.5, 7.0) * kbMult / a.stats.mass;
          const kbB = rnd(3.5, 7.0) * kbMult / b.stats.mass;

          a.vx = Math.cos(baseA + spreadA) * kbA;
          a.vy = Math.sin(baseA + spreadA) * kbA;
          b.vx = Math.cos(baseB + spreadB) * kbB;
          b.vy = Math.sin(baseB + spreadB) * kbB;

          a.hp = Math.max(0, a.hp - 1);
          b.hp = Math.max(0, b.hp - 1);

          // Hit cooldown shrinks with each level so collisions chain faster
          const cooldown = Math.max(3, 10 - suddenDeathLevel * 2);
          a.hitCooldown = cooldown;
          b.hitCooldown = cooldown;

          hits.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      }
    }
  }

  return { balls, hits };
}

export function checkWinner(balls: Ball[]): number | null {
  const alive = balls.filter(b => b.alive);

  // Still fighting
  if (alive.length > 0) {
    const first = alive[0].teamIndex;
    return alive.every(b => b.teamIndex === first) ? first : null;
  }

  // All exited ring on the same tick — pick the team with the highest remaining HP
  // (they were tougher in the final hit) — if tied, random
  const dead = balls.filter(b => !b.alive);
  if (dead.length === 0) return -1;

  let bestHp = -1;
  let winner = -1;
  const teamBestHp: Record<number, number> = {};
  for (const b of dead) {
    if ((teamBestHp[b.teamIndex] ?? -1) < b.hp) teamBestHp[b.teamIndex] = b.hp;
  }
  for (const [team, hp] of Object.entries(teamBestHp)) {
    if (hp > bestHp) { bestHp = hp; winner = Number(team); }
    else if (hp === bestHp) winner = Math.random() < 0.5 ? Number(team) : winner;
  }
  return winner;
}
