import { Screen } from '../App';
import AdBanner from './AdBanner';

interface Props {
  navigate: (s: Screen) => void;
}

export default function HomeScreen({ navigate }: Props) {
  return (
    <div className="screen center">
      <AdBanner slot="home-top" />
      <div className="home-card">
        <img src="/duelodecuchillos.png" alt="Duelo de Cuchillos" className="home-logo" />
        <h1 className="home-title">DUELO DE CUCHILLOS</h1>
        <p className="home-subtitle">La sala decide. La arena juzga.</p>
        <div className="btn-group" style={{ maxWidth: '100%', width: '100%' }}>
          <button className="btn btn-primary btn-big" onClick={() => navigate('host')}>
            Crear Sala
          </button>
          <button className="btn btn-secondary btn-big" onClick={() => navigate('join')}>
            Unirse
          </button>
        </div>
      </div>
    </div>
  );
}
