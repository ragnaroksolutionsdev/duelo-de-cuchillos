/**
 * AdBanner — placeholder listo para Google AdSense.
 *
 * Cuando AdSense apruebe la cuenta:
 * 1. Agrega en index.html:
 *    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 *
 * 2. Reemplaza el contenido de este componente por:
 *    <ins className="adsbygoogle"
 *         style={{ display: 'block' }}
 *         data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
 *         data-ad-slot={slot}
 *         data-ad-format="auto"
 *         data-full-width-responsive="true" />
 *    y llama a (window as any).adsbygoogle?.push({}) en un useEffect.
 */

interface Props {
  slot: string;  // ID del ad slot de AdSense (por ahora solo identifica la posición)
  label?: string;
}

export default function AdBanner({ label = 'Publicidad' }: Props) {
  return (
    <div className="ad-banner">
      <span className="ad-label">{label}</span>
    </div>
  );
}
