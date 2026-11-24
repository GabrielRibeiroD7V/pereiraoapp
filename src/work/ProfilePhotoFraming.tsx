import { useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { initialProfileCrop, profileCropRect } from './profileCrop';
import type { ProfileCrop } from './profileCrop';
import { gestureProfileCrop } from './profileCropGestures';
import type { CropPoint } from './profileCropGestures';
export function ProfilePhotoFraming({ src, value, onChange, onReady, disabled = false }: {
  src: string; value: ProfileCrop; onChange: (value: ProfileCrop) => void; onReady: (ready: boolean) => void; disabled?: boolean;
}) {
  const helpId = useId();
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const points = useRef(new Map<number, CropPoint>());
  const latest = useRef(value); latest.current = value;
  const gesture = useRef<{ crop: ProfileCrop; points: CropPoint[] } | null>(null);
  const rect = dimensions ? profileCropRect(dimensions.width, dimensions.height, value) : null;
  function point(event: PointerEvent<HTMLDivElement>): CropPoint {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.width };
  }
  function start() { gesture.current = { crop: latest.current, points: [...points.current.values()] }; }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.has(event.pointerId) || !gesture.current || !dimensions || disabled) return;
    points.current.set(event.pointerId, point(event));
    const next = gestureProfileCrop(dimensions.width, dimensions.height, gesture.current.crop, gesture.current.points, [...points.current.values()]);
    latest.current = next; onChange(next);
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.delete(event.pointerId)) return;
    if (points.current.size) start(); else gesture.current = null;
  }
  function cancelGesture() { points.current.clear(); gesture.current = null; }
  return <section className="profile-framing" aria-label="Enquadramento da foto principal">
    <p id={helpId}>Arraste com um dedo para posicionar o rosto. Use dois dedos para aproximar ou afastar.</p>
    <div className="profile-framing__circle" role="group" aria-label="Prévia circular do enquadramento" aria-describedby={helpId}
      onPointerDown={event => {
        if (disabled || !rect || points.current.size >= 2 || event.button !== 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (!box.width) return;
        points.current.set(event.pointerId, point(event)); start();
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelGesture} onLostPointerCapture={finish}>
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
    <details className="profile-framing__adjustments"><summary>Ajustes</summary>
    <fieldset disabled={disabled || !dimensions}><legend>Ajustar enquadramento</legend>
      <label>Zoom da foto<input type="range" min="1" max="3" step="0.05" value={value.zoom} onChange={event => onChange({ ...value, zoom: Number(event.target.value) })} /></label>
      <label>Posição horizontal<input type="range" min="0" max="1" step="0.01" value={value.x} onChange={event => onChange({ ...value, x: Number(event.target.value) })} /></label>
      <label>Posição vertical<input type="range" min="0" max="1" step="0.01" value={value.y} onChange={event => onChange({ ...value, y: Number(event.target.value) })} /></label>
      <button type="button" className="text-link" onClick={() => onChange({ ...initialProfileCrop })}>Redefinir enquadramento</button>
    </fieldset>
    </details>
    <p className="field-help">Somente a área enquadrada será enviada. A foto original da sua galeria não será alterada.</p>
  </section>;
}
