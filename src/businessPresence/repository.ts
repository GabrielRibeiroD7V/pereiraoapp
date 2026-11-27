import type { SupabaseClient } from '@supabase/supabase-js';
import type { Presence, PresenceRepository } from './model';
// Narrow boundary for the proposed RPCs; no service key and no arbitrary table/URL input.
export function createPresenceRepository(client:SupabaseClient,publicClient:SupabaseClient):PresenceRepository {
 return {
  async read(id,owner){const {data,error}=await (owner?client:publicClient).rpc('business_team_location',{target_business:id,owner_view:owner});if(error)throw error;return data as Presence;},
  async command(id,command,payload){const {data,error}=await client.rpc('business_team_location_command',{target_business:id,command,payload});if(error)throw error;return data;},
  async upload(path,file){
   if(file.type!=='image/webp'||!file.size||file.size>5242880)throw new Error('Foto preparada inválida.');
   const result=await client.storage.from('business-team').upload(path,file,{contentType:'image/webp',upsert:false});
   // A lost response is retried with the same immutable path; finalize validates the stored object.
   if(result.error && !['409','Duplicate'].includes(String(result.error.statusCode)))throw result.error;
  },
  async image(path,owner){const {data,error}=await (owner?client:publicClient).storage.from('business-team').createSignedUrl(path,60);if(error)throw error;return data.signedUrl;}
 };
}
