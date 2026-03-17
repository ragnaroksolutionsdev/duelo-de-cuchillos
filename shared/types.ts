export interface BallState {
  id: string;
  teamIndex: number;
  x: number;
  y: number;
  heading: number;
  alive: boolean;
  hp: number;       // 0-3, client can show damage state
}

export interface HitEvent {
  x: number;
  y: number;
}

export interface TeamConfig {
  index: number;
  answer: string;
  color: string;
  count: number;
}

export interface RoomConfig {
  code: string;
  question: string;
  answers: string[];
}

export interface GameStatePayload {
  tick: number;
  balls: BallState[];
  hits: HitEvent[];  // blood splash positions
}

export interface GameOverPayload {
  winnerTeamIndex: number;
  winnerAnswer: string;
  teamCounts: Record<number, number>;
}

export interface RoomUpdatePayload {
  teams: TeamConfig[];
  status: 'waiting' | 'playing' | 'finished';
}

export interface CountdownPayload {
  count: number;
}

export const TEAM_COLORS = ['#FF4757', '#1E90FF', '#2ED573', '#FFA502'];

export const ARENA = {
  CX: 400,
  CY: 400,
  RADIUS: 360,
  BALL_RADIUS: 18,
} as const;
