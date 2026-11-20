# PR #6 — Conta, cadastro e Espaço Profissional

## Experiência entregue

Conta segue a hierarquia da referência aprovada: avatar e nome, entrada amarela para Meu Espaço Profissional e linhas de menu compactas. Sem foto cadastrada, há um avatar neutro. A foto existente em `profiles.avatar_url` é exibida somente por HTTPS, com fallback em caso de erro; não há upload. Nome e foto são lidos do perfil persistido. Meus dados permite editar somente o nome, usando os privilégios/RLS já existentes. Não altera e-mail, senha, propriedade ou metadados de autorização.

Segurança e acesso apresenta o e-mail e reutiliza a recuperação de senha existente. Configurações está identificada como futura e não é um link fictício. Conta continua pública para visitantes. Somente Início, Buscar e Conta permanecem na navegação principal.

O cadastro conserva três etapas: identificação, informações do negócio e contatos/revisão. A categoria usa opções com ícones e suporte a teclado. A cidade principal aparece como incluída, sem checkbox repetido. A descrição tem exemplo apenas no placeholder. Dados empresariais privados ficam na terceira etapa, num grupo opcional expansível; dados existentes são preservados ao voltar/avançar. Não há preenchimento fictício automático.

Espaço Profissional permite escolher entre negócios da mesma conta e exibe nome, tipo, categoria, cidade e status reais. Editar perfil é a ação principal. Após salvar, retorna ao negócio editado. Meu perfil apresenta o contexto de gerenciamento; serviços, portfólio, assinatura e mensagens estão explicitamente pendentes, sem links ou botões enganosos. Não há métricas inventadas, dashboard financeiro ou publicação de perfil pela interface.

Os componentes reutilizáveis são `ProfileAvatar`, `MenuRow`, `BusinessStatus`, `CategoryIcon` e `StepProgress`. A nova apresentação usa os tokens existentes e Sass, mantendo React/TypeScript/Vite e o logo oficial. Home, Buscar e a estrutura pública permanecem fora do redesenho deste PR.

## Persistência e compatibilidade

O adaptador profissional e a RPC `create_business` não foram alterados. A criação continua transacional para negócio, owner e área inicial; o fluxo conserva checkpoint, bloqueio de envios concorrentes, tratamento de falha parcial e atualização sem payload de status/proprietário. Dados complementares continuam usando as requisições já existentes, sem nova promessa de atomicidade.

Leitura do projeto operacional exclusivo `yazdjiwaksamizrbqewq` em 20/11/2026 confirmou os dois negócios de teste como draft, com as categorias climatização/construção e cidade `mundo-novo-ms`. Os dois IDs, tipos e timestamps de atualização foram preservados. Nenhum deles foi editado, excluído ou recriado para testar este PR. Nenhum usuário, prestador ou dado empresarial fictício foi inserido no remoto.

Após revisão técnica e autorização específica em 20/11/2026, a proteção foi ativada no projeto operacional. O histórico agora contém `20261120214652`, `20261120215116` e `20261120223813`. Somente o grant de UPDATE de `status` foi revogado; Auth, URLs, SMTP, tabelas e RLS não foram alterados.

## Migração mínima de segurança — aplicada após revisão

Arquivo: [`20261120223813_restrict_business_status_update.sql`](../supabase/migrations/20261120223813_restrict_business_status_update.sql), gerado pelo Supabase CLI com `migration new`. Aplicado exclusivamente no projeto `yazdjiwaksamizrbqewq`, sem reaplicar versões anteriores. SQL local e histórico remoto têm MD5 `d1e01c33f2ba8bf23eba6addad126735`.

```sql
revoke update (status) on table public.businesses from authenticated;
```

A fundação concedeu UPDATE por coluna. A leitura operacional confirmou `has_table_privilege(..., 'UPDATE') = false` e privilégio UPDATE de `status` igual a true. Assim, retirar somente o grant dessa coluna bloqueia alterações de estado para owner/admin sem alterar as policies ou os demais campos. A RPC ainda cria draft por default e não aceita status como parâmetro.

Esse REVOKE impede também despublicação e outras trocas de estado pelo cliente. Uma futura ação de publicação/moderação deve usar um caminho confiável aprovado separadamente. Este PR não cria tal função e não libera publicação. Grants amplos adicionados futuramente precisariam ser reavaliados: revogar privilégio de coluna não neutraliza um privilégio UPDATE concedido à tabela inteira. Ver [PostgreSQL: REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html).

Os tipos do frontend deixam de oferecer `status` em Update de businesses, mas tipos não são barreira de segurança. O bloqueio agora está ativo no banco: `has_column_privilege('authenticated', 'public.businesses', 'status', 'UPDATE') = false` e não há privilégio UPDATE da tabela inteira. Os grants dos outros campos e a policy owner/admin permanecem iguais. A RPC continua com a mesma definição, acesso autenticado e default `draft`.

A aplicação do REVOKE (controle de privilégio/DCL) e o registro da versão exata no histórico ocorreram na mesma transação pela integração SQL. A ferramenta de migração não permite informar a versão existente do arquivo; esse procedimento evitou criar outra divergência de timestamp. Guardas conferiram o histórico anterior e os privilégios esperados antes da execução. Não houve edição ou limpeza de dados operacionais.

As verificações posteriores foram somente de leitura no remoto. Comparações de hashes antes/depois confirmaram os dados das nove tabelas, políticas, constraints e funções inalterados. Os dois rascunhos mantêm os mesmos IDs, status e timestamps. Não foram criados usuários ou negócios operacionais para ensaiar a proteção. A recusa de operações por owner/admin e a continuidade da edição comum foram exercitadas no PostgreSQL local isolado.

## Verificações

- Typecheck e build Vite aprovados.
- Testes de aplicação cobrem navegação pública/privada, sessão, menu pessoal, leitura/edição do nome canônico, seleção entre negócios, retorno ao negócio salvo, cadastro autônomo/empresa, categoria, cidade principal incluída, dados privados na revisão, navegação entre etapas, retomada de rascunho, falha parcial e bloqueio de envios repetidos.
- SDK real com transporte interceptado verifica consulta/PATCH do perfil pessoal restritos ao ID retornado por `auth.getUser()`, alterando exclusivamente `display_name`.
- PostgreSQL 17 nativo temporário, sem TCP e sem Docker: 54 verificações RLS/constraints aprovadas. Incluem recusa de alteração de status por owner e admin, preservação da edição dos outros campos, criação como draft, isolamento entre contas e leitura pública de fixtures publicadas por operador confiável somente no banco local.
- A migração inicial e seu hash continuam intactos; `npm run test:migrations` aprovado.
- Resultado de CI e preview é registrado no pull request.

## Responsividade e capturas reais do navegador

Foram renderizadas as telas reais da aplicação em navegador, com dependências de Auth/repositório injetadas usando contratos existentes. Os dados de demonstração e as mutações do ensaio são locais/em memória; não representam autenticação ou gravação operacional real. O harness temporário foi removido antes do commit e não integra o aplicativo ou o build de produção.

36 combinações de tela/largura foram verificadas: Conta, Espaço Profissional, três etapas, nome longo, vazio, falha e visitante, cada uma em 375, 390, 768 e 1280 px. `scrollWidth` coincidiu com a largura em todos os casos; a navegação teve três links. Métricas em [`screenshots/pr6/metrics.json`](screenshots/pr6/metrics.json).

O teclado selecionou a próxima categoria com ArrowRight e o foco acompanhou o controle. Ao avançar, o foco vai ao título da etapa. Não houve warnings/errors no console do ensaio. As capturas integrais incluem a navegação fixa na posição correspondente à altura de viewport de 900 px; a página continua rolável e tem espaço inferior para os controles.

| Tela | 375 px | 390 px | 768 px | 1280 px |
|---|---|---|---|---|
| Conta | [imagem](screenshots/pr6/conta-375.jpg) | [imagem](screenshots/pr6/conta-390.jpg) | [imagem](screenshots/pr6/conta-768.jpg) | [imagem](screenshots/pr6/conta-1280.jpg) |
| Espaço Profissional | [imagem](screenshots/pr6/espaco-375.jpg) | [imagem](screenshots/pr6/espaco-390.jpg) | [imagem](screenshots/pr6/espaco-768.jpg) | [imagem](screenshots/pr6/espaco-1280.jpg) |
| Identificação | [imagem](screenshots/pr6/etapa-1-375.jpg) | [imagem](screenshots/pr6/etapa-1-390.jpg) | [imagem](screenshots/pr6/etapa-1-768.jpg) | [imagem](screenshots/pr6/etapa-1-1280.jpg) |
| Informações | [imagem](screenshots/pr6/etapa-2-375.jpg) | [imagem](screenshots/pr6/etapa-2-390.jpg) | [imagem](screenshots/pr6/etapa-2-768.jpg) | [imagem](screenshots/pr6/etapa-2-1280.jpg) |
| Contatos/revisão | [imagem](screenshots/pr6/etapa-3-375.jpg) | [imagem](screenshots/pr6/etapa-3-390.jpg) | [imagem](screenshots/pr6/etapa-3-768.jpg) | [imagem](screenshots/pr6/etapa-3-1280.jpg) |

## Limitações e próximos passos

Os testes não substituem inspeção em um celular físico com teclado virtual, VoiceOver/TalkBack ou uma sessão real após deploy. Upload, serviços, portfólio, assinatura, chat, avaliações, orçamento e prévia pública não foram implementados. Nenhuma fotografia aleatória foi adicionada.

Não houve merge, publicação em produção ou no Lovable nesta ativação. O PR permanece aberto, com a migração já alinhada ao banco e o código consistente com os novos privilégios. A Vercel está ligada ao GitHub e usa main para produção; o merge pode disparar automaticamente build/deploy. Merge e publicação continuam aguardando autorização específica. A migração de banco foi uma operação separada e não depende da Vercel.
