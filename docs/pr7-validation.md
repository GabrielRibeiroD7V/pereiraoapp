# PR #7 — Serviços, fotografias e Storage

## Fluxo implementado

Espaço Profissional → negócio selecionado → Meus serviços / Meus trabalhos. As URLs privadas incluem o ID do negócio e preservam o retorno após login. O retorno ao Espaço Profissional mantém o negócio selecionado. As três abas principais e a landing page foram preservadas.

Meus serviços oferece criação, edição, ativação/desativação e exclusão com confirmação, nome/descrição/categoria e preço fixo, a partir de ou sob orçamento. Valores são tratados em centavos; orçamento grava preço NULL. IDs estáveis da tentativa e bloqueios de submissão previnem duplicação durante retentativas da mesma operação. Excluir serviço desassocia as fotografias atomicamente, sem apagar as fotos ou os arquivos.

Meus trabalhos oferece seleção de JPEG/PNG/WebP, prévia antes do envio, legenda, associação opcional a um serviço do mesmo negócio, edição dos detalhes, organização por controles de mover, ampliação e exclusão confirmada. Não é feed social. A fotografia é reduzida proporcionalmente a no máximo 1600 px no maior lado e reencodificada em WebP, qualidade .85. A origem pode ter até 10 MiB; o resultado deve ter até 5 MiB. Resolução acima de 40 megapixels ou falha de decodificação produz erro antes de enviar. O navegador não estica nem sobrepõe elementos à fotografia.

## Migração preparada, não aplicada

[`20261120225759_business_portfolio_storage.sql`](../supabase/migrations/20261120225759_business_portfolio_storage.sql), gerada com Supabase CLI `migration new`:

- Cria bucket privado `business-portfolio`, limite de 5 MiB por objeto e allowlist de MIME JPEG, PNG e WebP. Limites são aplicados pelo servidor Storage; a finalização também verifica metadados MIME/tamanho e extensão. Essa verificação usa os metadados definidos pelo serviço Storage, não é um antivírus ou análise completa de conteúdo.
- Adiciona `portfolio_items.media_state`: pending, ready, deleting. Registros anteriores são preservados como ready; novos registros começam pending. Caminho único impede dois metadados para o mesmo objeto.
- Retira do cliente a alteração de caminho/ordem e a exclusão direta dos metadados, mantendo edição de legenda/associação. Tipos do frontend refletem esses limites.
- Adiciona RPC de ciclo de vida da mídia e RPC transacional de exclusão de serviço. A lógica privilegiada de mídia fica no schema private, com search_path vazio, EXECUTE revogado de PUBLIC/anon e verificação explícita de auth.uid + owner/admin. O wrapper público é SECURITY INVOKER. Nenhuma RPC aceita proprietário, role ou status do negócio.
- Adiciona políticas RLS de objetos. INSERT exige registro pending do próprio negócio; DELETE exige deleting; overwrite/move por UPDATE não é permitido neste bucket. Guards restritivos impedem abertura por outra policy permissiva genérica, sem alterar o comportamento de outros buckets.
- Um trigger de INSERT específico deste bucket exige metadado pending e mantém lock de chave sobre ele na transação real de registro do objeto. Isso coordena uploads com exclusões concorrentes mesmo quando a API avalia RLS em preflight separado. Para outros buckets, o trigger retorna sem alterar o registro.
- Autoriza INSERT de ID de serviço gerado pelo cliente para recuperação da mesma tentativa; business_id continua sujeito à RLS. IDs e vínculo não são atualizáveis pelo cliente.

A fundação, a RPC create_business e a proteção de businesses.status não são alteradas. Nove tabelas existentes são reutilizadas; nenhuma é recriada. Não há nova tabela de cobrança, chat ou avaliações.

## Consistência entre banco e arquivos

PostgreSQL e Storage não são uma transação distribuída. O fluxo trata explicitamente as falhas:

1. **Envio:** prepara metadado pending com ID/caminho estáveis; envia ao caminho `<business_id>/portfolio/<item_id>.webp`, sem upsert; finaliza como ready somente após verificar que o objeto válido existe. Resposta perdida pode ser recuperada pelo mesmo ID. Uma falha não apaga fotos automaticamente: o item pending continua visível ao administrador para retomar/verificar/remover.
2. **Exclusão:** o usuário confirma; a RPC marca deleting (retirando novas leituras públicas), a API Storage remove o arquivo e a RPC remove metadados apenas se o objeto não existir mais. Falha mantém uma operação identificada como pendente. Retentar funciona mesmo quando a remoção anterior terminou e a resposta se perdeu. Não se usa SQL para apagar metadados de storage.objects no operacional.
3. **Reordenação:** RPC exige lista completa, sem repetidos, de fotografias ready do negócio, serializada por lock do negócio. Se a lista mudou, retorna conflito sem descartar itens.
4. **Serviço excluído:** a RPC desassocia fotos e remove serviço na mesma transação. FK composta impede associar fotografia a serviço de outro negócio.

Cancelamento de formulário não desfaz uma operação remota já iniciada. Envios/exclusões pendentes ficam identificados e exigem ação explícita do administrador; não há limpeza automática ou rotina de backup. Antes de uma futura exclusão integral de negócio, será necessário definir também a limpeza dos arquivos.

## Leitura privada e futura leitura pública

O bucket não usa URLs públicas permanentes. Gerentes autorizados leem seus objetos; membros podem ler fotografias ready do negócio. Anônimos só leem metadados/objetos ready de negócios published, conforme RLS. Draft, unpublished, pending e deleting não são expostos publicamente.

O aplicativo solicita URLs assinadas de 60 segundos para miniaturas e gera outra ao ampliar. Tokens assinados são autorizações temporárias de leitura: não são persistidos nem registrados pelo aplicativo. Um link já emitido permanece utilizável até expirar, mesmo após despublicar; novas solicitações seguem a RLS atual. O prazo de 60 segundos é o solicitado por este cliente, não uma garantia de que a API Storage impeça outro cliente autorizado de solicitar prazos diferentes. Conteúdo que já foi lido também pode ter sido copiado/cacheado pelo destinatário.

Esse modelo permite que a futura busca pública solicite imagens somente dos perfis elegíveis, sem service_role no frontend e sem publicar fotos dos rascunhos por engano. A busca e a página pública não são implementadas neste PR.

## Verificações e evidências

### Remoto — somente leitura

Main conferida em `dd1fabca536f500916f3944dac35f149d566ae53` (PR #6). Projeto exclusivo `yazdjiwaksamizrbqewq`, saudável, com as três migrações existentes. UPDATE direto de businesses.status continua bloqueado. Na preparação, services e portfolio_items tinham zero registros; não havia buckets ou policies de Storage. Não foram criados, alterados ou removidos registros comerciais, usuários, arquivos ou configurações no remoto.

### Local e simulado

- Typecheck, testes da aplicação, build e conferência do histórico local.
- PostgreSQL 17 nativo temporário: 90 verificações RLS/constraints, incluindo owner/admin/viewer/terceiro/anônimo; associações entre negócios; publicar status bloqueado; limites de finalização; idempotência; reordenação; remoção de serviço preservando fotos; exclusão em duas fases, prevenção de objeto sem metadado e privacidade mesmo diante de policy ampla. O schema mínimo de Storage no bootstrap é uma simulação SQL: não substitui HTTP, S3 ou limites físicos do servidor de upload.
- SDK Supabase real com transporte HTTP interceptado: preço/payloads, bloqueio antes da migração, manager check, resposta perdida na criação, caminho de upload, falha preservando pending, remoção condicionada ao Storage, retomada quando o arquivo já não existe e URLs temporárias. Nenhum destes casos enviou bytes ao Supabase operacional.
- Testes de formulário: criar preço fixo, confirmação/cancelamento de exclusão, foto preservada após excluir serviço, prévia antes do envio, liberação de blob URL, erro de exclusão preservando o diálogo e retorno de login para a rota privada.
- Navegador local: seleção de um PNG sintético pelo seletor real de arquivos, decodificação e reencodificação WebP, prévia, salvamento no repositório em memória, reordenação, ampliação e cancelamento de exclusão. A imagem cinza é exclusivamente um fixture sintético local, não uma fotografia atribuída a um prestador.
- 28 combinações de tela/largura em 375/390/768/1280 px: lista de serviços, editor com preço, portfólio, envio com prévia, confirmação de exclusão, vazio e ativação pendente. Sem overflow horizontal, diálogos dentro da viewport e três abas. Sem warnings/errors no console do ensaio. [Métricas](screenshots/pr7/metrics.json).

| Interface | Celular | Desktop |
|---|---|---|
| Serviços | [390 px](screenshots/pr7/servicos-390.jpg) | [1280 px](screenshots/pr7/servicos-1280.jpg) |
| Editor | [375 px](screenshots/pr7/editar-servico-375.jpg) | [1280 px](screenshots/pr7/editar-servico-1280.jpg) |
| Trabalhos | [390 px](screenshots/pr7/trabalhos-390.jpg) | [1280 px](screenshots/pr7/trabalhos-1280.jpg) |
| Prévia antes de enviar | [390 px](screenshots/pr7/enviar-fotografia-390.jpg) | [1280 px](screenshots/pr7/enviar-fotografia-1280.jpg) |
| Confirmação | [375 px](screenshots/pr7/confirmar-exclusao-375.jpg) | [1280 px](screenshots/pr7/confirmar-exclusao-1280.jpg) |

## Pendências para ativar

1. Revisar e autorizar especificamente a migração. Antes de aplicá-la, conferir novamente histórico, eventual bucket preexistente e unicidade dos caminhos. Não reaplicar versões anteriores.
2. Após ativação, autorizar um negócio/arquivos descartáveis específicos para ensaio real de HTTP Storage, upload, assinatura, remoção e retomada. Registros comerciais existentes não serão usados como teste. Nenhum novo ambiente ou usuário foi criado neste PR.
3. Conferir o fluxo em um celular físico, inclusive seleção de arquivos/teclado/permissões e conectividade instável. Os testes visuais realizados são de navegador com viewport emulada.
4. Revisar o PR e coordenar o merge com a ativação remota. A interface bloqueia este gerenciamento com mensagem explícita enquanto falta media_state, evitando gravações parciais contra a estrutura antiga. Merge não aplica migração. A integração GitHub/Vercel pode publicar a main automaticamente; este PR permanece aberto para revisão, sem merge ou deploy de produção executados pelo assistente.

Sem Asaas, chat, orçamento interno, avaliações, alterações da landing page, imagens aleatórias, Docker, backup manual ou publicação no Lovable.

Referências: [Storage e RLS](https://supabase.com/docs/guides/storage/security/access-control), [limites do bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals).
