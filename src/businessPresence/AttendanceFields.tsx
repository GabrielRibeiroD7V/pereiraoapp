import {FormField} from '../components/FormField';
import {CitySelect} from '../locations/CitySelect';
import type {ProfessionalCatalog} from '../professional/types';
import type {Location} from './model';
export function AttendanceFields({location,update,catalog}:{location:Location;update:<K extends keyof Location>(key:K,value:Location[K])=>void;catalog:ProfessionalCatalog}){return <>
 <label htmlFor="attendance-mode">Como você atende?</label><select id="attendance-mode" value={location.mode} onChange={e=>update('mode',e.target.value as Location['mode'])}><option value="home">A domicílio</option><option value="physical">Presencial</option><option value="both">Ambos</option></select>
 {location.mode!=='home'?<><p className="field-help">O endereço fica privado até você confirmar a localização e autorizar a exibição. Não usamos GPS nem geocodificação automática.</p>
 {(['postal_code','street','number','neighborhood','complement'] as const).map(key=><FormField key={key} id={`location-${key}`} label={{postal_code:'CEP',street:'Rua',number:'Número',neighborhood:'Bairro',complement:'Complemento (opcional)'}[key]} value={location[key]} maxLength={{postal_code:8,street:160,number:20,neighborhood:100,complement:120}[key]} inputMode={key==='postal_code'?'numeric':undefined} onChange={e=>{update(key,e.target.value);update('public_address',false);}}/>)}
 <CitySelect id="location-city" label="Cidade do estabelecimento" cities={catalog.cities.map(c=>({...c,stateCode:c.state_code}))} value={location.city_id} onChange={id=>{update('city_id',id);update('public_address',false);}}/>
 <label className="presence-consent"><input type="checkbox" checked={location.public_address} onChange={e=>update('public_address',e.target.checked)}/>Conferi a localização e autorizo a exibição pública deste endereço quando o perfil estiver no ar.</label></>:<p className="field-help">Use as cidades atendidas do perfil. Nenhum endereço residencial precisa ser divulgado. Se havia um endereço salvo, ele permanece privado.</p>}
</>;}
