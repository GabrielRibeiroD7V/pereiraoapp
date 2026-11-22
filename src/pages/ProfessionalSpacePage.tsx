import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { professionalError } from '../professional/validation';
import type { BusinessRow } from '../lib/database.types';
export function ProfessionalSpacePage() {
  const repository = useProfessionalRepository(), location = useLocation();
  const [rows,setRows] = useState<readonly BusinessRow[]|null>(null), [error,setError] = useState('');
  useEffect(()=>{let live=true;if(repository)void repository.listMine().then(value=>{if(live)setRows(value);}).catch(cause=>{if(live)setError(professionalError(cause));});return()=>{live=false;};},[repository]);
  const selected=rows?.find(row=>row.id===location.state?.businessId)??rows?.[0];
  if(selected)return <Navigate replace to={`/conta/profissional/${selected.id}/perfil`}/>;
  return <div><h1>Meu perfil profissional</h1>{error?<p role="alert">{error}</p>:!rows&&repository?<p role="status">Abrindo seu perfil…</p>:<><p>Crie seu perfil para apresentar sua bio, serviços e trabalhos.</p><Link className="button button--primary" to="/conta/profissional/cadastro">Cadastrar meu negócio</Link></>}</div>;
}
