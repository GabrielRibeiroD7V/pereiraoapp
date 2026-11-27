import { useAuth } from '../auth/AuthProvider';
import { readCheckpoint } from '../professional/checkpoint';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import type { BusinessRow } from '../lib/database.types';
export function ProfessionalSpacePage() {
  const repository = useProfessionalRepository(), location = useLocation(), {session}=useAuth();
  const [rows,setRows] = useState<readonly BusinessRow[]|null>(null), [error,setError] = useState('');
  useEffect(()=>{let live=true;if(repository)void repository.listMine().then(value=>{if(live)setRows(value);}).catch(cause=>{if(live)setError(professionalError(cause));});return()=>{live=false;};},[repository]);
  const remembered=location.state?.businessId??(session?readCheckpoint(session.user.id)?.businessId:undefined);
  const selected=rows?.find(row=>row.id===remembered)??rows?.[0];
  if(selected)return <Navigate replace to={`/conta/profissional/${selected.id}/perfil`}/>;
  if(rows?.length===0)return <Navigate replace to="/conta/profissional/cadastro"/>;
  return <div><h1>Meu perfil profissional</h1>{error?<p role="alert">{error}</p>:!rows&&repository?<p role="status">Abrindo seu perfil…</p>:<><p>Crie seu perfil para apresentar sua bio, serviços e trabalhos.</p><Link className="button button--primary" to="/conta/profissional/cadastro">Cadastrar meu negócio</Link></>}</div>;
}
