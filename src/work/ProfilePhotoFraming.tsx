import { useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { initialProfileCrop, profileCropRect } from './profileCrop';
import type { ProfileCrop } from './profileCrop';
export function ProfilePhotoFraming({ src, value, onChange, onReady, disabled = false }: {
  src: string; value: ProfileCrop; onChange: (value: ProfileCrop) => void; onReady: (ready: boolean) => void; disabled?: boolean;
}) {
  const helpId = useId();
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; crop: ProfileCrop; displaySize: number } | null>(null);
  const rect = dimensions ? profileCropRect(dimensions.width, dimensions.height, value) : null;
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !rect || !dimensions || disabled) return;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    onChange({ ...start.crop,
      x: dimensions.width > rect.size ? clamp(start.crop.x - (event.clientX - start.x) * rect.size / (start.displaySize * (dimensions.width - rect.size))) : .5,
      y: dimensions.height > rect.size ? clamp(start.crop.y - (event.clientY - start.y) * rect.size / (start.displaySize * (dimensions.height - rect.size))) : .5,
    });
  }
  return <section className="profile-framing" aria-label="Enquadramento da foto principal">
    <p id={helpId}>Arraste a foto para posicionar seu rosto no círculo. Use o zoom ou os controles de posição para ajustar.</p>
    <div className="profile-framing__circle" role="group" aria-label="Prévia circular do enquadramento" aria-describedby={helpId}
      onPointerDown={event => {
        if (disabled || !rect || drag.current || event.button !== 0) return;
        const displaySize = event.currentTarget.getBoundingClientRect().width;
        if (!displaySize) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop: value, displaySize };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <img src={src} alt="Prévia da nova foto principal" draggable={false} style={rect && dimensions ? {
        width: `${dimensions.width / rect.size * 100}%`, height: `${dimensions.height / rect.size * 100}%`, left: `${-rect.x / rect.size * 100}%`, top: `${-rect.y / rect.size * 100}%`,
      } : { visibility: 'hidden' }} onLoad={event => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
        if (width > 0 && height > 0) { setFailed(false); setDimensions({ width, height }); onReady(true); }
        else onReady(false);
      }} onError={() => { setFailed(true); setDimensions(null); onReady(false); }} />
    </div>
    {failed && <p role="alert">Não foi possível mostrar a prévia. Cancele e escolha outra foto; a foto anterior foi mantida.</p>}
    {!dimensions && !failed && <p role="status">Carregando a prévia do enquadramento… Se ela não aparecer, cancele e escolha outra foto.</p>}
    <fieldset disabled={disabled || !dimensions}><legend>Ajustar enquadramento</legend>
      <label>Zoom da foto<input type="range" min="1" max="3" step="0.05" value={value.zoom} onChange={event => onChange({ ...value, zoom: Number(event.target.value) })} /></label>
      <label>Posição horizontal<input type="range" min="0" max="1" step="0.01" value={value.x} onChange={event => onChange({ ...value, x: Number(event.target.value) })} /></label>
      <label>Posição vertical<input type="range" min="0" max="1" step="0.01" value={value.y} onChange={event => onChange({ ...value, y: Number(event.target.value) })} /></label>
      <button type="button" className="text-link" onClick={() => onChange({ ...initialProfileCrop })}>Redefinir enquadramento</button>
    </fieldset>
    <p className="field-help">Somente a área enquadrada será enviada. A foto original da sua galeria não será alterada.</p>
  </section>;
}
