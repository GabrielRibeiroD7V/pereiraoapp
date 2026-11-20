# PR #5 — Autenticação real e hospedagem Vercel

## Conexão verificada em 20/11/2026

Projeto exclusivo: `yazdjiwaksamizrbqewq`. Histórico remoto com as versões `20261120214652_backend_auth_foundation` e `20261120215116_business_primary_category`. Nenhuma migração foi reaplicada. As nove tabelas estão com RLS; `businesses.category_id` está disponível. As consultas operacionais foram somente de leitura e o advisor de segurança não retornou alertas.

A API pública retornou seis categorias e uma cidade. Visitantes não conseguem consultar `profiles`, `business_members` ou `business_details`. O endpoint de configurações públicas de Auth informa e-mail habilitado, cadastro habilitado e `mailer_autoconfirm=false`, exigindo confirmação. Não foram criados usuários ou negócios operacionais nesta verificação.

## Configuração Vercel

Projeto `pereirao`, equipe `77badblock-5101s-projects`; domínio `pereirao.vercel.app` associado e verificado. Framework Vite, instalação `npm ci`, build `npm run build`, saída `dist`. Configurar em Production, Preview e Development:

- `VITE_SUPABASE_URL`: `https://yazdjiwaksamizrbqewq.supabase.co`.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave moderna publishable do mesmo projeto, já cadastrada pela integração. Não versionar seu valor.

As duas variáveis são públicas e incorporadas no build Vite. Nenhuma `service_role`, chave secreta, senha ou credencial de administração é necessária no frontend. Alterações de variáveis exigem novo build. `vercel.json` encaminha rotas internas ao SPA e define `Referrer-Policy: no-referrer` para evitar enviar URLs de callback a outros sites.

## Auth e redirects exatos

O cliente real usa PKCE, persistência e renovação de sessão. Signup, login, recuperação, atualização de senha, logout e troca de código já utilizam o SDK. Este PR preserva o destino do cadastro e de edição durante confirmação/recuperação. O destino é limitado a rotas locais e armazenado por até 24 horas, sem dados pessoais ou tokens. Link de confirmação PKCE deve ser aberto no mesmo navegador onde o fluxo começou.

No painel Supabase, para produção:

- Site URL: `https://pereirao.vercel.app`.
- Redirect URL: `https://pereirao.vercel.app/auth/retorno`.
- Redirect URL: `https://pereirao.vercel.app/auth/retorno?flow=recovery`.

Não usar wildcard. Previews não recebem autorização de callback implicitamente: cada origem necessita aprovação e entradas exatas. Na leitura inicial do painel, Site URL era `http://localhost:3000` e a lista de redirects estava vazia. A integração disponível não oferece administração dessas configurações; sua atualização e releitura ainda precisam ser concluídas. Não houve alteração de SMTP ou templates.

## Validação executada

- Typecheck e build Vite aprovados.
- 69 testes automatizados de interface/adaptadores aprovados, incluindo retorno após confirmação, recuperação, bloqueio de destinos externos, expiração de estado e configuração de projeto.
- 49 verificações SQL/RLS aprovadas em PostgreSQL 17 nativo temporário: isolamento entre contas, propriedade da RPC, colisão/atomicidade, restrições, categoria e criação como draft. Sem Docker e sem escrita no remoto.
- Histórico local reconciliado e hash da migração inicial conferido.

A execução SQL local requer `PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:sql` quando o PATH aponta somente ao pacote cliente libpq. A primeira tentativa encontrou essa diferença no PATH; repetir com o servidor instalado concluiu os testes. GitHub Actions executa PostgreSQL 17 nativo no runner.

## Limites e ensaio operacional pendente

O teste com SDK interceptado e os testes SQL isolados não substituem uma sessão real. Está autorizada uma conta de teste controlada pelo usuário e dois negócios draft (autônomo e empresa), com vínculos/áreas e um registro empresarial privado, seguidos de limpeza restrita a esses registros. A senha será definida e o e-mail confirmado pelo usuário diretamente no aplicativo. Não registrar senha, código de e-mail ou tokens no Git/chat/relatório.

Após configurar os redirects: criar conta, confirmar no mesmo navegador, entrar, criar ambos os rascunhos, verificar owner/categoria/dados privados, editar, sair e entrar novamente para conferir persistência. Encerrar a sessão e remover exclusivamente os registros do ensaio. Não considerar esses passos aprovados antes de executá-los.

Uma conta autorizada não permite comprovar isolamento entre duas identidades reais no remoto; esse isolamento foi validado no PostgreSQL isolado. A RPC cria draft e o formulário não envia status/propriedade. A política existente permite ao owner/admin alterar status diretamente pela API. Enforcement de aprovação/publicação no backend é uma pendência antes da abertura pública de perfis; não foi alterado neste PR, que não autoriza mudanças de schema/policies.

O usuário autorizou posteriormente hospedar na Vercel. Este PR não adiciona assinaturas, pagamentos, serviços, portfólio ou publicação no Lovable.
