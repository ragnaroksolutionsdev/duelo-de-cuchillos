import { useEffect, useState } from 'react';
import HomeScreen from './components/HomeScreen';
import HostScreen from './components/HostScreen';
import JoinScreen from './components/JoinScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import { TeamConfig, GameOverPayload } from 'shared/types';
import { getSocket } from './lib/socket';
import { track } from './lib/analytics';

export type Screen = 'home' | 'host' | 'join' | 'lobby' | 'game' | 'results';

export interface RoomInfo {
  roomCode: string;
  hostToken?: string;
  isHost: boolean;
  mode?: 'public' | 'solo';
  question: string;
  answers: string[];
  teams: TeamConfig[];
  ballId?: string;
  teamIndex?: number;
  teamColor?: string;
}

export default function App() {
  const [screen, setScreen]         = useState<Screen>('home');
  const [room, setRoom]             = useState<RoomInfo | null>(null);
  const [gameOver, setGameOver]     = useState<GameOverPayload | null>(null);
  const [initialCode, setInitialCode] = useState<string | undefined>();

  // Deep link: /?room=ABCD → go directly to join with code pre-filled
  useEffect(() => {
    track('page_view');
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('room')?.toUpperCase().slice(0, 4);
    if (code) {
      setInitialCode(code);
      setScreen('join');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listen for room_reset (rematch by host)
  useEffect(() => {
    const socket = getSocket();
    function handleRoomReset(data: { autoStart: boolean }) {
      setGameOver(null);
      setScreen(data.autoStart ? 'game' : 'lobby');
    }
    socket.on('room_reset', handleRoomReset);
    return () => { socket.off('room_reset', handleRoomReset); };
  }, []);

  function navigate(s: Screen) { setScreen(s); }

  function handleRematch() {
    if (!room) return;
    const socket = getSocket();
    socket.emit('rematch', { roomCode: room.roomCode, hostToken: room.hostToken }, (res: any) => {
      if (res?.error) console.error('Rematch error:', res.error);
    });
  }

  return (
    <div className="app">
      {screen === 'home' && <HomeScreen navigate={navigate} />}

      {screen === 'host' && (
        <HostScreen
          navigate={navigate}
          onRoomCreated={(info) => {
            setRoom(info);
            track('room_created', info.roomCode);
            setScreen(info.mode === 'solo' ? 'game' : 'lobby');
          }}
        />
      )}

      {screen === 'join' && (
        <JoinScreen
          navigate={navigate}
          initialCode={initialCode}
          onJoined={(info) => {
            setRoom(info);
            track('player_joined', info.roomCode);
            setScreen('lobby');
          }}
        />
      )}

      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room}
          navigate={navigate}
          onGameStarted={(teams) => { setRoom(r => r ? { ...r, teams } : r); setScreen('game'); }}
        />
      )}

      {screen === 'game' && room && (
        <GameScreen
          room={room}
          onGameOver={(payload) => {
            setGameOver(payload);
            track('game_completed', room.roomCode);
            setScreen('results');
          }}
        />
      )}

      {screen === 'results' && gameOver && room && (
        <ResultsScreen
          gameOver={gameOver}
          room={room}
          onRematch={handleRematch}
          onLeave={() => { setRoom(null); setGameOver(null); setScreen('home'); }}
        />
      )}
    </div>
  );
}
