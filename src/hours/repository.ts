import type{SupabaseClient}from'@supabase/supabase-js';
import type{Database}from'../lib/database.types';
import{validateHours}from'./model';import type{HoursRepository,Period}from'./model';
export function createHoursRepository(client:SupabaseClient<Database>,publicClient:SupabaseClient<Database>):HoursRepository{return{
 async available(){const{error}=await client.from('business_working_hours').select('business_id').limit(0);if(error&&['42P01','PGRST205'].includes(error.code))return false;if(error)throw error;return true;},
 async get(id,publicOnly=false){const{data,error}=await(publicOnly?publicClient:client).from('business_working_hours').select('enabled,timezone,schedule,accepts_outside_hours,updated_at').eq('business_id',id).maybeSingle();
 if(error&&['42P01','PGRST205'].includes(error.code))return{available:false,data:null};if(error)throw error;
 return{available:true,data:data?{enabled:data.enabled,timezone:data.timezone,schedule:data.schedule as unknown as Period[][],acceptsOutsideHours:data.accepts_outside_hours,updatedAt:data.updated_at}:null};},
 async save(id,value){const message=validateHours(value);if(message)throw Error(message);const{error}=await client.rpc('save_business_working_hours',{target_business:id,p_enabled:value.enabled,p_timezone:value.timezone,p_schedule:value.schedule,p_accepts_outside_hours:value.acceptsOutsideHours,p_expected_updated_at:value.updatedAt});if(error)throw error;}
};}
