import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import{MemoryRouter,Link}from'react-router-dom';
import{App}from'../../../src/app/App';
import{createSocialDemo}from'../../../src/test/socialDemo';
import'../../../src/styles/main.scss';
const demo=createSocialDemo();
function Demo(){const[index,setIndex]=useState(0),f=demo.fixtures[index]!;return <><aside style={{background:'#fff6c2',padding:12,position:'relative',zIndex:12}}><strong>Demonstração local — autenticação e mensagens SIMULADAS em memória.</strong><p>Não informa credenciais, não usa Supabase e não cria prestadores públicos. Recarregar encerra os dados adicionais desta demonstração.</p><label>Identidade: <select aria-label="Identidade da demonstração" value={index} onChange={e=>setIndex(Number(e.target.value))}><option value={0}>Demonstração A</option><option value={1}>Demonstração B</option></select></label></aside><MemoryRouter key={index} initialEntries={['/mensagens']}><nav aria-label="Cenários locais" style={{padding:12,display:'flex',gap:16,flexWrap:'wrap'}}><Link to="/conta">Meu perfil de demonstração</Link><Link to={`/prestadores/${demo.people[1-index]!.slug}`}>Outro perfil</Link><Link to={`/mensagens/${demo.conversationId}`}>Conversa A ↔ B</Link><Link to="/">Home local</Link></nav><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} marketplaceRepository={demo.marketplace} managedPosts={f.managed} publicPosts={demo.publicPosts} messageRepository={demo.messages(index)} subscriptionRepository={null} adminRepository={null}/></MemoryRouter></>;}
createRoot(document.getElementById('root')!).render(<Demo/>);
