# PR #17 — Ativação financeira e avaliação do receptor

## Operações concluídas

- Branch mantida: feat/asaas-sandbox, sem novo PR/merge.
- Aplicada exclusivamente a migração financeira revisada, checksum a2690165f6a4c1863ea6ffff82407a44503f6913e490db4931ea80939e9bbdf4. O MCP registrou inicialmente a versão 20261121154510; apenas esse registro novo foi reconciliado para o ID do arquivo 20261121031038. As oito versões anteriores não foram alteradas. Há nove migrações. Não houve reaplicação.
- As sete tabelas financeiras privadas têm RLS e nenhum SELECT direto de anon/authenticated. Banco sem chave inicialmente falhou fechado.
- HMAC e webhook gerados independentemente no PostgreSQL com 48 bytes aleatórios cada, representados em hexadecimal. Somente SHA-256 binário do HMAC armazenado na tabela privada. O digest também é segredo.
- Transporte da provisão: PGP com chave pública RSA efêmera de 2048 bits e AES-256; o SQL contém somente a chave pública, nunca os segredos/digest literais. A resposta contém somente ciphertext. Decifração em armazenamento temporário local com permissões restritas; sem valores no relatório, frontend ou logs da aplicação. Ferramentas auxiliares locais fora do repositório.
- Provisionados BILLING_RPC_SIGNING_SECRET e ASAAS_SANDBOX_WEBHOOK_TOKEN como Sensitive/Secret na Vercel, somente Preview e branch feat/asaas-sandbox. Flags de homologação ASAAS_SANDBOX_ENABLED e VITE_SANDBOX_BILLING no mesmo escopo. Nenhuma flag Pix. Chave Asaas existente não lida/decriptada.

## Teste real da RPC após provisionamento

Executado por HTTP/PostgREST com chave publishable e assinatura HMAC legítima de servidor, sem service_role, JWT artificial ou cookies. Esse teste não é uma sessão de usuário nem um checkout autenticado do frontend.

- Prova inválida: HTTP 401, SQLSTATE 42501.
- Prova correta para admin_overview: HTTP 200, environment sandbox, zero contratos/pagamentos/receita.
- Repetição exata do nonce: HTTP 409, SQLSTATE 23505.
- Nonce técnico: b88a9962-ad2e-49f2-ac41-6bf1b5b6378f. Nenhum negócio ou usuário criado.

## Avaliação antes de qualquer exceção Vercel

A autenticação Vercel continua habilitada em all_except_custom_domains. Nenhum hostname foi liberado.

A aplicação permite páginas públicas e usa RequireAuth nas páginas privadas. O backend financeiro valida bearer por Supabase Auth getUser; deriva o UUID dessa resposta, restringe ações/campos, confere origem quando presente e exige vínculo owner/admin confirmado/ativo no banco. O painel exige papel administrativo real. Funções HMAC validam prova, nonce, prazo, usuário, papel e moderação. Os sete conjuntos financeiros privados não têm acesso direto. Respostas administrativas/financeiras usam private,no-store e o PWA exclui APIs/dados privados. Guards financeiros rejeitam Production.

Esses controles reduzem exposição de dados, mas não tornam uma liberação completa equivalente a expor apenas um webhook. Liberar o alias tornaria públicas todas as páginas/assets e permitiria tentativas contra login e APIs. Outros usuários legítimos autorizados poderiam acessar a jornada Sandbox e gerar operações sintéticas após consentimento. Há limites de body, autenticação e idempotência; não foi implementado rate limiter distribuído adicional. Por isso, nenhuma exceção foi aplicada.

## Alternativa proposta: um receptor restrito no Supabase

Endpoint único: https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook. Código preparado em supabase/functions, ainda não publicado. O listener só aceita o caminho exato e POST, autentica o token antes de ler o corpo, limita a 64 KiB e encaminha apenas ao endpoint fixo /api/asaas-webhook do Preview da branch. Não encaminha cookies, bearer ou headers controlados pelo chamador; não aceita destino arbitrário ou redirects. Não recebe a chave Asaas nem acessa diretamente o banco.

O header interno x-vercel-protection-bypass exige um terceiro segredo independente. A credencial é de projeto e tem alcance mais amplo que a rota; o isolamento externo depende do destino fixo do receptor e de sua guarda. Ela deve ser armazenada somente no receptor e revogada quando encerrada a homologação. Nunca incluir em URLs, logs ou frontend. A Vercel continuará revalidando o token do webhook e só responderá 200 após persistência/deduplicação da inbox. O receptor só repassa ACK 200 com projeção reconhecida; timeouts/erros/HTML da proteção não viram sucesso.

A publicação da função, o bypass adicional e os segredos do receptor foram apresentados para autorização específica. Nenhum bypass ou receptor foi criado. A integração atual do Supabase não oferece operação de secrets de Edge Functions; será necessário um canal autorizado de provisionamento privado (dashboard/CLI autenticado) antes de publicar. Não embutir segredos no código e não usar endpoint público de bootstrap. A função usa autenticação própria de webhook, portanto somente ela precisaria verify_jwt=false, sem alterar as demais funções.

Não contratar plano ou add-on; utilizar somente o projeto existente e verificar limites/quotas antes da ativação. Se houver custo adicional, parar para aprovação. A alternativa preserva a proteção de todo o Preview e não exige nova migração.

## Matriz atual

| Teste | Tipo | Resultado |
| --- | --- | --- |
| Migração/RLS/HMAC e replay | Remoto, Supabase operacional | Aprovados nas verificações acima |
| Autenticação, destino fixo, body limitado e falhas do receptor | Local, 18 testes com mocks | Aprovados; não são entrega real |
| Checkout integrado/cartão e conciliação | Pendente | Não iniciado nesta ativação; precisa da rota externa e sessão legítima |
| Webhook pelo Asaas | Pendente | Não configurado enquanto a decisão de receptor estiver pendente |
| Cartão anterior | Real Sandbox, histórico | Homologado anteriormente, estornado e cancelado; não equivale ao ensaio integrado atual |
| Pix | Desligado | Nenhuma nova tentativa; causa de BOLETO não comprovada |

Não há publicação de perfis, início/reinício de gratuidade, operação financeira real, merge ou deploy de produção. Capturas/relatório históricos permanecem identificados como históricos. O diagnóstico de senha vazada do Auth continua WARN preexistente; não alterar Auth nesta tarefa. Os avisos INFO de RLS sem políticas nas tabelas privadas correspondem ao desenho fechado com RPCs restritas e grants revogados.

Fontes: [exceções Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions), [bypass por header](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), [segredos Edge Functions](https://supabase.com/docs/guides/functions/secrets).

## Verificações da preparação atual

Typecheck, build/PWA, 374 testes automatizados (30 arquivos) e 303 asserções SQL/RLS locais aprovados. Os 18 testes novos são do receptor preparado, ainda não publicado. PWA mantém a versão ac212b083325d0e185c1 e os mesmos assets de frontend. GitHub Actions/Preview serão conferidos no head após o push e registrados no corpo do PR.

A guia do Chrome abriu /conta no alias aprovado e mostrou a experiência de visitante, sem sessão PEREIRÃO. Não houve extração/transporte de cookies ou tokens de outro Preview. A única etapa privada solicitada é login do proprietário diretamente nesse alias; nenhum formulário profissional ou cartão precisa ser cadastrado manualmente pelo usuário.
