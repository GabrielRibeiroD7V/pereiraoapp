import {useEffect,useState} from 'react';
import {ContactLinks} from '../marketplace/ContactLinks';
import {usePresence} from './PresenceProvider';
import {mapLinks} from './model';
import type {PresenceRepository,TeamMember} from './model';
export function TeamPortrait({member,repository,owner}:{member:TeamMember;repository:PresenceRepository;owner:boolean}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let live=true;setUrl('');if(member.photo_path)void repository.image(member.photo_path,owner).then(value=>{if(live)setUrl(value);}).catch(()=>{});return()=>{live=false;};},[member.photo_path,repository,owner]);
 return url?<img className="team-portrait" src={url} alt={`Foto de ${member.name}`} loading="lazy"/>:<span className="team-portrait team-portrait--empty" aria-label="Sem fotografia">{member.name.slice(0,1)}</span>;
}
export function PresenceSections({businessId,company,owner=false}:{businessId:string;company:boolean;owner?:boolean}){
 const {data,error,repository}=usePresence(businessId,owner);
 if(error)return <p role="status" className="field-help">Equipe e localização indisponíveis no momento.</p>;
 if(!data||!repository)return null;
 const location=data.location,links=location&&mapLinks(location),members=data.members.filter(m=>m.active);
 return <div className="business-presence">
 {location&&<section aria-label="Local de atendimento"><h2>Local de atendimento</h2><p>{location.mode==='physical'?'Atendimento presencial':location.mode==='both'?'Atendimento presencial e a domicílio':'Atendimento a domicílio'}</p>
 {links?<><p>{[location.street,location.number,location.neighborhood,location.complement,`${location.city}/${location.state}`,location.postal_code].filter(Boolean).join(', ')}</p><nav className="work-actions" aria-label="Como chegar"><a href={links.google} target="_blank" rel="noopener noreferrer">Como chegar · Google Maps</a><a href={links.apple} target="_blank" rel="noopener noreferrer">Apple Maps</a></nav></>:<p className="field-help">Endereço não divulgado. Consulte as cidades atendidas.</p>}</section>}
 {company&&<section aria-label="Nossa equipe"><h2>Nossa equipe</h2>{members.length?<ul className="team-grid">{members.map(member=><li key={member.id}><TeamPortrait member={member} repository={repository} owner={owner}/><h3>{member.name}</h3>{member.profession&&<p className="team-profession">{member.profession}</p>}{member.specialties.length>0&&<p>{member.specialties.join(' · ')}</p>}{member.bio&&<p>{member.bio}</p>}<ContactLinks name={member.name} whatsapp={member.whatsapp} compact/></li>)}</ul>:<p className="field-help">Equipe ainda não informada.</p>}<p className="field-help">Informações declaradas pela empresa. As mensagens pelo PEREIRÃO são recebidas na conversa central do estabelecimento.</p></section>}
 </div>;
}
