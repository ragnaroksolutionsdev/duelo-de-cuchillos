import { useState } from 'react';
import { getSocket } from '../lib/socket';
import { Screen, RoomInfo } from '../App';
import { TeamConfig, TEAM_COLORS } from 'shared/types';
import ShareModal from './ShareModal';

interface Props {
  navigate: (s: Screen) => void;
  onRoomCreated: (info: RoomInfo) => void;
}

export default function HostScreen({ navigate, onRoomCreated }: Props) {
  const [mode, setMode] = useState<'public' | 'solo' | null>(null);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(['', '']);
  const [ballsPerTeam, setBallsPerTeam] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showShare, setShowShare] = useState(false);

  // Step 2 (public only): pick team after room creation
  const [pendingRoom, setPendingRoom] = useState<{
    roomCode: string; hostToken: string; question: string; answers: string[]; teams: TeamConfig[];
  } | null>(null);

  function addAnswer() {
    if (answers.length < 4) setAnswers([...answers, '']);
  }

  function removeAnswer(i: number) {
    if (answers.length <= 2) return;
    setAnswers(answers.filter((_, idx) => idx !== i));
  }

  function createRoom() {
    const trimmedQ = question.trim();
    const trimmedA = answers.map(a => a.trim()).filter(Boolean);
    if (!trimmedQ) return setError('Escribe la pregunta.');
    if (trimmedA.length < 2) return setError('Necesitas al menos 2 respuestas.');
    setError('');
    setLoading(true);

    const socket = getSocket();
    socket.emit('create_room', { question: trimmedQ, answers: trimmedA, mode, ballsPerTeam }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);

      if (mode === 'solo') {
        // Auto-started: go directly to game as spectator
        onRoomCreated({
          roomCode: res.roomCode,
          hostToken: res.hostToken,
          isHost: true,
          mode: 'solo',
          question: res.question,
          answers: res.answers,
          teams: res.teams as TeamConfig[],
        });
      } else {
        // Public: pick team first
        setPendingRoom({
          roomCode: res.roomCode,
          hostToken: res.hostToken,
          question: res.question,
          answers: res.answers,
          teams: res.teams as TeamConfig[],
        });
      }
    });
  }

  function joinAsTeam(teamIndex: number) {
    if (!pendingRoom) return;
    setLoading(true);
    const socket = getSocket();
    socket.emit('join_room', { roomCode: pendingRoom.roomCode, teamIndex }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      onRoomCreated({
        roomCode: pendingRoom.roomCode,
        hostToken: pendingRoom.hostToken,
        isHost: true,
        mode: 'public',
        question: res.question,
        answers: res.answers,
        teams: res.teams as TeamConfig[],
        ballId: res.ballId,
        teamIndex: res.teamIndex,
        teamColor: res.teamColor,
      });
    });
  }

  // Step 0: choose mode
  if (!mode) {
    return (
      <div className="screen center">
        <button className="btn-back" onClick={() => navigate('home')}>← Volver</button>
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 8 }}>
          Tipo de sala
        </h2>
        <p className="hint" style={{ textAlign: 'center', marginBottom: 24 }}>
          ¿Cómo quieres jugar?
        </p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => setMode('public')}>
            <span className="mode-icon">👥</span>
            <span className="mode-title">Pública</span>
            <span className="mode-desc">Comparte el código y que otros voten. ¡Las respuestas pelean!</span>
          </button>
          <button className="mode-card" onClick={() => setMode('solo')}>
            <span className="mode-icon">🤖</span>
            <span className="mode-title">Individual</span>
            <span className="mode-desc">Solo tú defines la pregunta y ves la pelea al instante.</span>
          </button>
        </div>
      </div>
    );
  }

  // Step 2 (public): pick team
  if (pendingRoom) {
    return (
      <div className="screen">
        {showShare && <ShareModal roomCode={pendingRoom.roomCode} onClose={() => setShowShare(false)} />}
        <div className="lobby-header">
          <h2 className="section-title">Tu bando</h2>
          <div className="room-code-badge">{pendingRoom.roomCode}</div>
        </div>
        <div className="question-box">
          <p className="question-label">La pregunta:</p>
          <p className="question-text">{pendingRoom.question}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowShare(true)}>
          🔗 Compartir sala
        </button>
        <p className="team-select-label">¿Qué eliges tú?</p>
        <div className="team-grid">
          {pendingRoom.answers.map((answer, i) => (
            <button
              key={i}
              className="btn btn-team"
              style={{ '--team-color': TEAM_COLORS[i] } as React.CSSProperties}
              onClick={() => joinAsTeam(i)}
              disabled={loading}
            >
              <span className="team-ball" style={{ background: TEAM_COLORS[i] }} />
              {answer}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // Step 1: create room
  return (
    <div className="screen">
      <button className="btn-back" onClick={() => setMode(null)}>← Volver</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 className="section-title">
          {mode === 'solo' ? '🤖 Sala Individual' : '👥 Sala Pública'}
        </h2>
      </div>

      <div className="form-group">
        <label>Pregunta</label>
        <input
          className="input"
          placeholder="¿A dónde va el proyecto?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={120}
        />
      </div>

      <div className="form-group">
        <label>Respuestas</label>
        {answers.map((a, i) => (
          <div key={i} className="answer-row">
            <span className="color-dot" style={{ background: TEAM_COLORS[i] }} />
            <input
              className="input"
              placeholder={`Respuesta ${i + 1}`}
              value={a}
              onChange={e => {
                const copy = [...answers];
                copy[i] = e.target.value;
                setAnswers(copy);
              }}
              maxLength={50}
            />
            {answers.length > 2 && (
              <button className="btn-remove" onClick={() => removeAnswer(i)}>✕</button>
            )}
          </div>
        ))}
        {answers.length < 4 && (
          <button className="btn btn-ghost" onClick={addAnswer}>+ Agregar respuesta</button>
        )}
      </div>

      {mode === 'solo' && (
        <div className="form-group">
          <label>Bolitas por respuesta: <strong style={{ color: '#00e5ff' }}>{ballsPerTeam}</strong></label>
          <input
            type="range"
            min={1} max={15} step={1}
            value={ballsPerTeam}
            onChange={e => setBallsPerTeam(Number(e.target.value))}
            className="balls-slider"
          />
          <p className="hint">1 = duelo íntimo · 15 = caos total</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn btn-primary" onClick={createRoom} disabled={loading}>
        {loading
          ? 'Creando...'
          : mode === 'solo' ? '⚔️ ¡Iniciar Pelea!' : 'Crear Sala →'}
      </button>
    </div>
  );
}
