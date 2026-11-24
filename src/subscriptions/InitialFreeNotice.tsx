import {useEffect,useState} from 'react';
import {useSubscriptions} from './SubscriptionProvider';
/** Só afirma a fase quando confirmada pelo backend; compatível antes da migração. */
export function useInitialFreePhase(){
 const repository=useSubscriptions(),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{let live=true;setConfirmed(false);void repository?.accessStatus?.().then(status=>{if(live)setConfirmed(status?.phase==='initial_free');}).catch(()=>{if(live)setConfirmed(false);});return()=>{live=false;};},[repository]);
 return confirmed;
}
export function FreePhaseNotice(){return <section className="form-notice" aria-label="Fase inicial gratuita"><strong>Fase inicial gratuita</strong><p>Perfil básico, serviços, publicações e conversas são gratuitos nesta fase. Os 90 dias não estão correndo.</p><p>Uma assinatura futura será opcional, com benefícios e condições apresentados antes da sua decisão. Não há conversão ou cobrança automática. A publicação do perfil continua sujeita à revisão administrativa.</p></section>;}
export function InitialFreeNotice(){return useInitialFreePhase()?<FreePhaseNotice/>:null;
}
