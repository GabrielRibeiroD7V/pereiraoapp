import { describe, expect, it } from 'vitest';
import { gestureProfileCrop } from './profileCropGestures';
import { initialProfileCrop, profileCropRect } from './profileCrop';
describe('gestos do enquadramento',()=>{
 it('arrasta com um dedo em foto vertical',()=>{
  expect(gestureProfileCrop(900,1600,initialProfileCrop,[{x:.5,y:.5}],[{x:.5,y:.6}]).y).toBeCloseTo(.5-.1*900/700);
 });
 it('pinça preserva o ponto da imagem sob o centro dos dedos',()=>{
  const before={x:.3,y:.2,zoom:1.5};
  const result=gestureProfileCrop(900,1600,before,[{x:.2,y:.3},{x:.6,y:.3}],[{x:.1,y:.3},{x:.7,y:.3}]);
  expect(result.zoom).toBeCloseTo(2.25);
  const a=profileCropRect(900,1600,before),b=profileCropRect(900,1600,result);
  expect(a.x+.4*a.size).toBeCloseTo(b.x+.4*b.size);
  expect(a.y+.3*a.size).toBeCloseTo(b.y+.3*b.size);
 });
 it('limita zoom e posição mesmo quando os dedos saem da janela',()=>{
  const result=gestureProfileCrop(900,1600,initialProfileCrop,[{x:.4,y:.5},{x:.6,y:.5}],[{x:-10,y:-10},{x:10,y:10}]);
  expect(result.zoom).toBe(3);expect(result.x).toBeGreaterThanOrEqual(0);expect(result.x).toBeLessThanOrEqual(1);expect(result.y).toBeGreaterThanOrEqual(0);expect(result.y).toBeLessThanOrEqual(1);
  expect(gestureProfileCrop(900,1600,initialProfileCrop,[{x:0,y:0},{x:1,y:1}],[{x:.5,y:.5},{x:.51,y:.51}]).zoom).toBe(1);
 });
 it('pontos coincidentes ou quantidade inválida não geram NaN',()=>{
  expect(gestureProfileCrop(900,1600,initialProfileCrop,[{x:.5,y:.5},{x:.5,y:.5}],[{x:.5,y:.5},{x:.5,y:.5}])).toEqual(initialProfileCrop);
  expect(gestureProfileCrop(900,1600,initialProfileCrop,[],[])).toEqual(initialProfileCrop);
 });
});
