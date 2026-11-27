// Fixtures exclusivamente locais; nunca semeiam o Supabase.
import { categories } from '../config/categories';
export const categoryCatalog16 = [
  ...categories.map(({id,name})=>({id,name})),
  {id:'seguranca-eletronica',name:'Segurança eletrônica'},
  {id:'energia-solar',name:'Energia solar'},
  {id:'hidraulica',name:'Hidráulica'},
  {id:'eventos-decoracao',name:'Eventos e decoração'},
  {id:'materiais-ferramentas',name:'Materiais e ferramentas'},
  {id:'tecnologia',name:'Tecnologia'},
  {id:'serralheria-metalurgica',name:'Serralheria e Metalúrgica'},
  {id:'mecanica-automotivo',name:'Mecânica e Automotivo'},
  {id:'jardinagem-paisagismo',name:'Jardinagem e Paisagismo'},
  {id:'beleza-estetica',name:'Beleza e Estética'},
];
