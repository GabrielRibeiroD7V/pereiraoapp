// Isolated UI fixture; never imported by the production application.
import {vi} from 'vitest';
import {CONSENT,emptyLocation} from '../businessPresence/model';
import type {Presence,PresenceRepository,TeamMember} from '../businessPresence/model';
export function teamFixture(n:number):TeamMember[]{return Array.from({length:n},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,name:`Integrante local ${i+1}`,profession:'Profissão declarada',specialties:['Atendimento'],whatsapp:'',bio:'Demonstração local, sem dados reais.',position:i,active:true,photo_path:null,version:1,consent_version:CONSENT}));}
export function presenceFixture(n=0){
 let data:Presence={location:null,members:teamFixture(n)};
 const repository:PresenceRepository={
 read:vi.fn(async()=>structuredClone(data)),
 command:vi.fn(async(_id,command,payload)=>{
  if(command==='location')data.location={...emptyLocation,...payload,version:Number(payload.version)+1} as typeof emptyLocation;
  if(command==='save'){const member=payload as TeamMember;const index=data.members.findIndex(m=>m.id===member.id);if(index<0)data.members.push({...member,version:1});else data.members[index]={...data.members[index]!,...member,version:member.version+1};}
  if(command==='remove')data.members=data.members.filter(m=>m.id!==payload.id);
  if(command==='photo_prepare')return {path:'local-only/photo.webp',ready:false};
  if(command==='photo_finish')data.members=data.members.map(m=>m.id===payload.id?{...m,photo_path:'local-only/photo.webp',version:m.version+1}:m);
  return structuredClone(data);
 }),
 upload:vi.fn(async()=>{}),image:vi.fn(async()=> 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="72" height="72"/%3E'),
 };
 return {repository,get:()=>data};
}
