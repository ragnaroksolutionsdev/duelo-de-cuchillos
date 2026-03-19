import { Server } from 'socket.io';
import { tick, checkWinner } from './PhysicsEngine';
import { getRoom, deleteRoom, RoomState } from './RoomManager';
import { TICK_MS } from '../config';
import { ARENA } from '../../../shared/types';
import { saveResult, updateRoomStatus } from '../db/roomRepository';

const { RADIUS } = ARENA;

const SUDDEN_DEATH_START  = Math.floor(5_000 / TICK_MS); // tick where sudden death begins
const LEVEL_INTERVAL      = Math.floor( 5_000 / TICK_MS); // ticks per level (~5s)
const RING_SHRINK_PER_LVL = 28;                           // px per level
const MIN_RING_RADIUS     = 160;                          // ring never smaller than this

function calcSuddenDeathLevel(tick: number): number {
  if (tick < SUDDEN_DEATH_START) return 0;
  return Math.floor((tick - SUDDEN_DEATH_START) / LEVEL_INTERVAL) + 1;
}

function calcRingRadius(level: number): number {
  if (level <= 0) return RADIUS;
  return Math.max(MIN_RING_RADIUS, RADIUS - (level - 1) * RING_SHRINK_PER_LVL);
}

const activeLoops = new Map<string, NodeJS.Timeout>();

export function startGameLoop(io: Server, room: RoomState) {
  if (activeLoops.has(room.code)) return;

  let lastLevel = 0;

  const interval = setInterval(() => {
    const r = getRoom(room.code);
    if (!r || r.status !== 'playing') {
      clearInterval(interval);
      activeLoops.delete(room.code);
      return;
    }

    const level      = calcSuddenDeathLevel(r.tick);
    const ringRadius = calcRingRadius(level);

    // Emit sudden_death event whenever level increases
    if (level > lastLevel) {
      lastLevel = level;
      io.to(room.code).emit('sudden_death', { level });
    }

    const { balls, hits } = tick(r.balls, level, ringRadius);
    r.tick++;

    const ballRadius = r.tick === 1
      ? Math.max(9, 18 - Math.floor(r.balls.length / 4))
      : undefined;

    // Send ringRadius whenever ring is shrinking (level > 0), else omit
    const ringRadiusPayload = level > 0 ? Math.round(ringRadius) : undefined;

    io.to(room.code).emit('game_state', {
      tick: r.tick,
      balls: balls.map(b => ({
        id: b.id,
        teamIndex: b.teamIndex,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        heading: Math.round(b.heading * 100) / 100,
        alive: b.alive,
        hp: b.hp,
      })),
      hits,
      ballRadius,
      ringRadius: ringRadiusPayload,
    });

    const winner = checkWinner(r.balls);
    if (winner !== null) {
      clearInterval(interval);
      activeLoops.delete(room.code);
      r.status = 'finished';

      const teamCounts: Record<number, number> = {};
      r.players.forEach(p => {
        teamCounts[p.teamIndex] = (teamCounts[p.teamIndex] ?? 0) + 1;
      });

      const winnerAnswer = winner >= 0 ? r.answers[winner] : 'Empate';

      io.to(room.code).emit('game_over', { winnerTeamIndex: winner, winnerAnswer, teamCounts });

      updateRoomStatus(r.code, 'finished', { finished_at: new Date().toISOString() }).catch(console.error);
      if (winner >= 0) {
        saveResult({
          roomCode: r.code, winnerTeamIndex: winner, winnerAnswer,
          teamPlayerCounts: teamCounts, totalTicks: r.tick,
        }).catch(console.error);
      }

      setTimeout(() => {
        const current = getRoom(r.code);
        if (current?.status !== 'waiting') deleteRoom(r.code);
      }, 30_000);
    }
  }, TICK_MS);

  activeLoops.set(room.code, interval);
}

export function stopGameLoop(code: string) {
  const interval = activeLoops.get(code);
  if (interval) { clearInterval(interval); activeLoops.delete(code); }
}
