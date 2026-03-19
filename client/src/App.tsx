import { useEffect, useState } from 'react';
import HomeScreen from './components/HomeScreen';
import HostScreen from './components/HostScreen';
import JoinScreen from './components/JoinScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import { TeamConfig, GameOverPayload } from 'shared/types';
import { getSocket } from './lib/socket';

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
  const [screen, setScreen] = useState<Screen>('home');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);

  function navigate(s: Screen) { setScreen(s); }

  // Listen for room_reset (rematch initiated by host)
  useEffect(() => {
    const socket = getSocket();
    function handleRoomReset(data: { autoStart: boolean }) {
      setGameOver(null);
      navigate(data.autoStart ? 'game' : 'lobby');
    }
    socket.on('room_reset', handleRoomReset);
    return () => { socket.off('room_reset', handleRoomReset); };
  }, []);

  function handleRematch() {
    if (!room) return;
    const socket = getSocket();
    socket.emit('rematch', { roomCode: room.roomCode, hostToken: room.hostToken }, (res: any) => {
      if (res?.error) console.error('Rematch error:', res.error);
      // Navigation handled by room_reset event
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
            navigate(info.mode === 'solo' ? 'game' : 'lobby');
          }}
        />
      )}
      {screen === 'join' && (
        <JoinScreen navigate={navigate} onJoined={(info) => { setRoom(info); navigate('lobby'); }} />
      )}
      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room}
          navigate={navigate}
          onGameStarted={(teams) => { setRoom(r => r ? { ...r, teams } : r); navigate('game'); }}
        />
      )}
      {screen === 'game' && room && (
        <GameScreen
          room={room}
          onGameOver={(payload) => { setGameOver(payload); navigate('results'); }}
        />
      )}
      {screen === 'results' && gameOver && room && (
        <ResultsScreen
          gameOver={gameOver}
          room={room}
          onRematch={handleRematch}
          onLeave={() => { setRoom(null); setGameOver(null); navigate('home'); }}
        />
      )}
    </div>
  );
}
