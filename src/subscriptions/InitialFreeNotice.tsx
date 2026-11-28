import {useEffect,useState} from 'react';
import {useSubscriptions} from './SubscriptionProvider';
/** Só afirma a fase quando confirmada pelo backend; compatível antes da migração. */
export function useInitialFreePhase(){
 const repository=useSubscriptions(),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{let live=true;setConfirmed(false);void repository?.accessStatus?.().then(status=>{if(live)setConfirmed(status?.phase==='initial_free');}).catch(()=>{if(live)setConfirmed(false);});return()=>{live=false;};},[repository]);
 return confirmed;
}
/** Informação administrativa; não é oferta ou prazo para o usuário. */
export function FreePhaseNotice(){return <section className="form-notice" aria-label="Política comercial"><strong>Gratuidade por prazo indeterminado</strong><p>A plataforma permanece gratuita até uma decisão administrativa própria. Disponibilizar planos e contratar individualmente são etapas separadas; nenhuma conta é convertida automaticamente em assinatura.</p><p>A publicação é feita pelo responsável, com moderação posterior. Isenções e direitos existentes são preservados.</p></section>;}
export function InitialFreeNotice(){return useInitialFreePhase()?<FreePhaseNotice/>:null;
}
