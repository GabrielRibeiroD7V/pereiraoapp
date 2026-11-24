// Exclusivamente demonstração LOCAL em memória. Não é Supabase Auth ou banco real.
import {createWorkFixtures,fixtureBusinessId,fixtureImage} from './workFixtures';
import {postsFixtures} from './postsFixtures';
import {marketplaceFixture,publicProviderFixture} from './marketplaceFixtures';
import type {ChatMessage,MessageRepository} from '../messages/repository';
import type {ManagedPosts,ManagedPost} from '../posts/types';
import type {PublicMarketplace} from '../marketplace/types';
const people=[{id:'00000000-0000-4000-8000-000000009901',uid:'demo-a',name:'Demonstração A',slug:'demonstracao-a'},{id:'00000000-0000-4000-8000-000000009902',uid:'demo-b',name:'Demonstração B',slug:'demonstracao-b'}];
const conversationId='00000000-0000-4000-8000-000000009950';
export function createSocialDemo(){
 const fixtures=people.map((person,index)=>{
  const f=createWorkFixtures();
  // Só altera o objeto da fixture, nunca uma conta ou registro do aplicativo.
  void f.professional.getEditable(fixtureBusinessId).then(({business})=>{Object.assign(business,{id:person.id,name:person.name,slug:person.slug,status:'published'});});
  f.gateway.getSession=async()=>({user:{id:person.uid,email:null,displayName:person.name}});
  const get=f.professional.getEditable;
  f.professional.getEditable=async id=>{const r=await get(id);return{...r,input:{...r.input,name:person.name,description:'Perfil sintético isolado para avaliar navegação. Não representa prestador real.',categoryId:'climatizacao',cityId:'mundo-novo-ms',areaCityIds:['mundo-novo-ms']}};};
  const original=postsFixtures().snapshot()[0]!;
  const post:ManagedPost={...original,id:`00000000-0000-4000-8000-00000000991${index}`,business_id:person.id,title:`Projeto local ${index?'B':'A'}`,description:'Publicação sintética da demonstração local. Sem clientes, obras ou parceiros reais.',status:'published',published_at:original.created_at};
  const own=(bid:string)=>{if(bid!==person.id)throw{code:'42501'};};
  const managed:ManagedPosts={...postsFixtures().managed,
   get:async(bid,id)=>{own(bid);return id===post.id?post:null;},
   load:async(bid,page)=>{own(bid);return{business:{id:bid,name:person.name,status:'published'},posts:{items:[post],page,hasNext:false}};},
   imageUrl:async(bid)=>{own(bid);return fixtureImage;},
   save:async()=>{throw{code:'42501'};},command:async()=>{throw{code:'42501'};},
  };
  return{...f,managed,post};
 });
 const rows:ChatMessage[]=[{id:'00000000-0000-4000-8000-000000009960',senderId:people[0]!.uid,body:'Mensagem de demonstração A para B.',createdAt:'2026-11-24T15:00:00Z'},{id:'00000000-0000-4000-8000-000000009961',senderId:people[1]!.uid,body:'Resposta de demonstração B para A.',createdAt:'2026-11-24T15:01:00Z'}];
 const messages=(index:number):MessageRepository=>{
  const person=people[index];if(!person)throw new Error('Identidade fora da demonstração');
  const check=(id:string)=>{if(id!==conversationId)throw{code:'42501'};};
  return{list:async()=>[{id:conversationId,businessId:people[1]!.id,businessName:people[1]!.name,businessSlug:people[1]!.slug,customerName:people[0]!.name,side:index?'professional':'customer',updatedAt:rows.at(-1)!.createdAt,lastMessage:rows.at(-1)!.body}],messages:async id=>{check(id);return{items:[...rows],hasMore:false,customerId:people[0]!.uid};},open:async(bid,body)=>{if(index!==0||bid!==people[1]!.id)throw{code:'42501'};await messages(index).send(conversationId,body);return conversationId;},send:async(id,body)=>{check(id);if(!body.trim()||body.length>2000)throw{code:'23514'};rows.push({id:crypto.randomUUID(),senderId:person.uid,body:body.trim(),createdAt:new Date().toISOString()});}};
 };
 const base=marketplaceFixture(),providers=people.map(person=>({...publicProviderFixture,id:person.id,name:person.name,slug:person.slug,description:'Profissional sintético local. Não é cadastro real.',whatsapp:null,instagram:null}));
 const marketplace:PublicMarketplace={...base,search:async(_filters,page)=>({items:page===1?providers:[],page,hasNext:false}),getProvider:async slug=>providers.find(p=>p.slug===slug)??null,getImageUrl:async()=>fixtureImage};
 const works=fixtures.map((f,index)=>({...postsFixtures().work,id:f.post.id,businessId:people[index]!.id,title:f.post.title,description:f.post.description,business:{...postsFixtures().work.business,id:people[index]!.id,name:people[index]!.name,slug:people[index]!.slug}}));
 return{people,fixtures,messages,marketplace,conversationId,publicPosts:{list:async()=>({items:works,next:null}),get:async(id:string)=>works.find(p=>p.id===id)??null}};
}
