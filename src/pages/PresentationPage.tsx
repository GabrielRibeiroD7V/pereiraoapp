import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { PresentationEditor } from '../presentation/PresentationEditor';
import { professionalError } from '../professional/validation';
export function PresentationPage() {
 const {businessId=''}=useParams(),repository=useProfessionalRepository(),navigate=useNavigate();
 const [company,setCompany]=useState<boolean|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;if(repository)void repository.getEditable(businessId).then(value=>{if(live)setCompany(value.input.type==='empresa');}).catch(cause=>{if(live)setError(professionalError(cause));});return()=>{live=false;};},[businessId,repository]);
 return <div><Link className="back-link" to={`/conta/profissional/${businessId}/perfil`}>Voltar ao perfil</Link><h1>Editar apresentação profissional</h1>{error?<p role="alert">{error}</p>:company===null?<p role="status">Carregando perfil…</p>:<PresentationEditor key={businessId} businessId={businessId} company={company} onSaved={()=>navigate(`/conta/profissional/${businessId}/perfil`,{replace:true,state:{saved:true}})}/>}</div>;
}
