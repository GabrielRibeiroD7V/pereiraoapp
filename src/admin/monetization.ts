import { supabase } from "../lib/supabase";
export interface MonetizationStatus {
  monthlyCents: number;
  newContractsEnabled: boolean;
  contractingReady: boolean;
  initialFree: boolean;
  revision: number;
  checkoutEnabled: false;
  enforcementEnabled: false;
  automaticConversion: false;
  subscriptions: number;
  productionBindings: number;
  pendingPayments: number;
  sandboxContracts: number;
  productionReconciledPayments: number;
  integration?: { credentialsConfigured: boolean; webhookEnabled: boolean; validated: false };
}
export interface MonetizationRepository {
  status(signal?: AbortSignal): Promise<MonetizationStatus>;
  set(enabled: boolean, revision: number, reason: string): Promise<MonetizationStatus>;
}
async function call(body: unknown, signal?: AbortSignal): Promise<MonetizationStatus> {
  if (!supabase) throw {code:"SETUP_REQUIRED"};
  const {data,error}=await supabase.auth.getSession();
  if (error || !data.session) throw {code:"AUTH_REQUIRED"};
  const response=await fetch("/api/admin",{method:"POST",cache:"no-store",signal,
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+data.session.access_token},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw {code:result.code};
  return result.data;
}
export const monetizationRepository: MonetizationRepository={
  status:signal=>call({action:"monetization_status"},signal),
  set:(enabled,revision,reason)=>call({action:"monetization_policy",enabled,revision,reason,confirmation:"CONFIRMAR NOVAS CONTRATACOES"}),
};
