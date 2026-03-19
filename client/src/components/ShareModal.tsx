import { useState } from 'react';

interface Props {
  roomCode: string;
  onClose: () => void;
}

export default function ShareModal({ roomCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl  = `${window.location.origin}/?room=${roomCode}`;
  const shareText = `¡Únete a mi sala en Duelo de Cuchillos! ⚔️ Código: ${roomCode}`;

  async function nativeShare() {
    try {
      await navigator.share({ title: 'Duelo de Cuchillos', text: shareText, url: shareUrl });
    } catch {}
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openWhatsApp() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');
  }

  function openFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  }

  function openTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <h3 className="share-title">Compartir sala</h3>
          <button className="share-close" onClick={onClose}>✕</button>
        </div>

        <p className="share-hint">Cualquiera con este link entra directo a tu sala:</p>

        <div className="share-link-box">
          <span className="share-link-text">{shareUrl}</span>
          <button className="btn btn-ghost share-copy-btn" onClick={copyLink}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="share-buttons">
          {typeof navigator.share === 'function' && (
            <button className="share-btn share-btn-native" onClick={nativeShare}>
              📱 Compartir
            </button>
          )}
          <button className="share-btn share-btn-whatsapp" onClick={openWhatsApp}>
            💬 WhatsApp
          </button>
          <button className="share-btn share-btn-facebook" onClick={openFacebook}>
            📘 Facebook
          </button>
          <button className="share-btn share-btn-twitter" onClick={openTwitter}>
            🐦 X / Twitter
          </button>
        </div>
      </div>
    </div>
  );
}
