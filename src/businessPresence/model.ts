export const TEAM_LIMIT = 10;
export const CONSENT = 'team-public-v1';
export type Attendance = 'physical' | 'home' | 'both';
export type Location = { mode: Attendance; postal_code: string; street: string; number: string; neighborhood: string; complement: string; city_id: string; public_address: boolean; version: number; city?: string; state?: string };
export const emptyLocation: Location = { mode:'home',postal_code:'',street:'',number:'',neighborhood:'',complement:'',city_id:'',public_address:false,version:0 };
export type TeamMember = { id:string; name:string; profession:string; specialties:string[]; whatsapp:string; bio:string; position:number; active:boolean; photo_path:string|null; version:number; consent_version:string };
export type Presence = {location:Location|null;members:TeamMember[]};
export type PresenceRepository = {
 read(id:string, owner:boolean):Promise<Presence>;
 command(id:string,command:string,payload:Record<string,unknown>):Promise<unknown>;
 upload(path:string,file:Blob):Promise<void>;
 image(path:string,owner:boolean):Promise<string>;
};
export function locationError(value: Location) {
 if(value.postal_code && !/^\d{8}$/.test(value.postal_code)) return 'Informe um CEP com oito dígitos.';
 if(value.public_address && (value.mode==='home'||!value.street.trim()||!value.number.trim()||!value.neighborhood.trim()||!value.city_id||!value.postal_code)) return 'Para exibir o endereço, confirme o atendimento presencial e preencha CEP, rua, número, bairro e cidade.';
 return '';
}
export function mapLinks(value:Location):{google:string;apple:string}|null {
 if(!value.public_address || value.mode==='home' || !value.street?.trim() || !value.number?.trim() || !value.city || !value.state || !value.postal_code) return null;
 const destination=[value.street,value.number,value.neighborhood,value.complement,`${value.city}/${value.state}`,value.postal_code,'Brasil'].filter(Boolean).join(', ');
 return {google:`https://www.google.com/maps/dir/?${new URLSearchParams({api:'1',destination})}`,apple:`https://maps.apple.com/?${new URLSearchParams({daddr:destination,dirflg:'d'})}`};
}
