import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { RoomInfo } from '../App';
import { ArenaScene } from '../game/scenes/ArenaScene';
import { TEAM_COLORS } from 'shared/types';

interface Props {
  room: RoomInfo;
  socket: Socket;
}

export default function PhaserGame({ room, socket }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const size = Math.min(window.innerWidth, window.innerHeight, 700);

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      backgroundColor: '#0a0a1a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 800,
      },
      scene: [ArenaScene],
      parent: containerRef.current,
    });

    // Pass socket and team info via registry
    game.registry.set('socket', socket);
    game.registry.set('teamColors', TEAM_COLORS);
    game.registry.set('myTeamIndex', room.teamIndex ?? -1);
    game.registry.set('myBallId', room.ballId ?? '');

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} id="phaser-root" className="phaser-container" />;
}
