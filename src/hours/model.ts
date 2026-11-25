export type Period={start:string;end:string};
export type WorkingHours={enabled:boolean;timezone:string;schedule:Period[][];acceptsOutsideHours:boolean;updatedAt:string|null};
export const weekdays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
export const timezones=[{id:'America/Campo_Grande',label:'Mato Grosso do Sul'},{id:'America/Sao_Paulo',label:'Paraná'}];
export const emptyHours=(state='MS'):WorkingHours=>({enabled:false,timezone:state==='PR'?'America/Sao_Paulo':'America/Campo_Grande',schedule:Array.from({length:7},()=>[]),acceptsOutsideHours:false,updatedAt:null});
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
export function validateHours(value:WorkingHours):string{
 if(!timezones.some(t=>t.id===value.timezone))return 'Selecione um fuso disponível.';
 if(!Array.isArray(value.schedule)||value.schedule.length!==7)return 'Confira os dias de atendimento.';
 const ranges:{start:number;end:number}[]=[];
 for(let day=0;day<7;day++){
  const periods=value.schedule[day];if(!Array.isArray(periods)||periods.length>2)return 'Use até dois intervalos por dia.';
  for(const p of periods){if(!p||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.end))return 'Preencha início e fim de cada intervalo.';
   const start=minutes(p.start),end=minutes(p.end);ranges.push({start:day*1440+start,end:day*1440+end+(end<=start?1440:0)});
  }
 }
 if(value.enabled&&!ranges.length)return 'Selecione pelo menos um dia de atendimento.';
 for(let i=0;i<ranges.length;i++)for(let j=i+1;j<ranges.length;j++)for(const shift of [-10080,0,10080])if(ranges[i]!.start<ranges[j]!.end+shift&&ranges[j]!.start+shift<ranges[i]!.end)return 'Há horários sobrepostos. Confira também o término no dia seguinte.';
 return '';
}
export function periodLabel(p:Period){return !p.start||!p.end?'Preencha início e fim.':p.start===p.end?'24 horas':`${p.start}–${p.end}${p.end<p.start?' (dia seguinte)':''}`;}
export function openAt(hours:WorkingHours,now=new Date()):boolean|null{
 if(!hours.enabled||validateHours(hours)||!Number.isFinite(now.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:hours.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(key:string)=>parts.find(v=>v.type===key)?.value??'';
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday')),current=day*1440+Number(part('hour'))*60+Number(part('minute'));
 return hours.schedule.some((periods,d)=>periods.some(p=>{const start=d*1440+minutes(p.start),end=d*1440+minutes(p.end)+(p.end<=p.start?1440:0);return[-10080,0,10080].some(shift=>current>=start+shift&&current<end+shift);}));
}
export interface HoursRepository {available():Promise<boolean>;get(id:string,publicOnly?:boolean):Promise<{available:boolean;data:WorkingHours|null}>;save(id:string,value:WorkingHours):Promise<void>}
