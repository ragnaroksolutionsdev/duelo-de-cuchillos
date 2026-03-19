import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Screen, RoomInfo } from '../App';
import { TeamConfig, TEAM_COLORS } from 'shared/types';

interface Props {
  navigate: (s: Screen) => void;
  onJoined: (info: RoomInfo) => void;
  initialCode?: string;
}

interface RoomPreview {
  question: string;
  answers: string[];
  teams: TeamConfig[];
}

export default function JoinScreen({ navigate, onJoined, initialCode }: Props) {
  const [code, setCode] = useState(initialCode ?? '');
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialCode && initialCode.length === 4) searchRoom();
  }, []);

  function searchRoom() {
    const trimCode = code.trim().toUpperCase();
    if (trimCode.length !== 4) return setError('Código de 4 caracteres.');
    setError('');
    setLoading(true);
    const socket = getSocket();
    socket.emit('get_room', { roomCode: trimCode }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      setPreview(res as RoomPreview);
    });
  }

  function joinWithTeam(teamIndex: number) {
    const trimCode = code.trim().toUpperCase();
    setLoading(true);
    setError('');
    const socket = getSocket();
    socket.emit('join_room', { roomCode: trimCode, teamIndex }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      onJoined({
        roomCode: trimCode,
        isHost: false,
        question: res.question,
        answers: res.answers,
        teams: res.teams as TeamConfig[],
        ballId: res.ballId,
        teamIndex: res.teamIndex,
        teamColor: res.teamColor,
      });
    });
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={() => navigate('home')}>← Volver</button>
      <h2 className="section-title">Unirse a Sala</h2>

      <div className="form-group">
        <label>Código de Sala</label>
        <div className="code-input-row">
          <input
            className="input code-input"
            placeholder="ABCD"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 4)); setPreview(null); setError(''); }}
            maxLength={4}
            onKeyDown={e => e.key === 'Enter' && searchRoom()}
          />
          <button className="btn btn-secondary" onClick={searchRoom} disabled={loading || code.length !== 4}>
            {loading ? '...' : 'Buscar'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {preview && (
        <>
          <div className="question-box">
            <p className="question-label">La pregunta:</p>
            <p className="question-text">{preview.question}</p>
          </div>

          <div className="team-select">
            <p className="team-select-label">¿Cuál es tu respuesta?</p>
            <div className="team-grid" style={{ gridTemplateColumns: `repeat(${Math.min(preview.answers.length, 2)}, 1fr)` }}>
              {preview.answers.map((answer, i) => (
                <button
                  key={i}
                  className="btn btn-team"
                  style={{ '--team-color': TEAM_COLORS[i] } as React.CSSProperties}
                  onClick={() => joinWithTeam(i)}
                  disabled={loading}
                >
                  <span className="team-ball" style={{ background: TEAM_COLORS[i] }} />
                  {answer}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
