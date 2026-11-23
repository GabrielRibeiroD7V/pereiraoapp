import { profileCropRect } from './profileCrop';
import type { ProfileCrop } from './profileCrop';
export interface CropPoint { x: number; y: number }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const midpoint = (points: readonly CropPoint[]) => points.length === 2
  ? { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 } : points[0]!;
/** Points use coordinates relative to the crop window (0..1); no browser or file access. */
export function gestureProfileCrop(width: number, height: number, crop: ProfileCrop, start: readonly CropPoint[], current: readonly CropPoint[]): ProfileCrop {
  if (!start.length || start.length > 2 || start.length !== current.length) return crop;
  const before = profileCropRect(width, height, crop);
  const from = midpoint(start), to = midpoint(current);
  let zoom = crop.zoom;
  if (start.length === 2) {
    const initialDistance = Math.hypot(start[1]!.x - start[0]!.x, start[1]!.y - start[0]!.y);
    if (initialDistance < .001) return crop;
    const distance = Math.hypot(current[1]!.x - current[0]!.x, current[1]!.y - current[0]!.y);
    zoom = clamp(crop.zoom * distance / initialDistance, 1, 3);
  }
  const size = Math.min(width, height) / zoom;
  // Keep the image point under the fingers anchored while moving their midpoint or zooming.
  const left = before.x + from.x * before.size - to.x * size;
  const top = before.y + from.y * before.size - to.y * size;
  return { x: width > size ? clamp(left / (width - size), 0, 1) : .5,
    y: height > size ? clamp(top / (height - size), 0, 1) : .5, zoom };
}
