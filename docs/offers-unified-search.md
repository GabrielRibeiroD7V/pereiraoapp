# Ofertas próprias e busca unificada — proposta de implantação

## Estado e escopo

Branch `feat/offers-unified-search`, baseada na main `338f588c221a25080cc2b7f8e868dac478f77184`.
Sem alteração operacional, publicação, migração remota, merge ou modificação financeira.
O PR de horários é independente; sua migração não está nesta branch.

## Modelo aditivo

| Objeto | Finalidade e acesso |
|---|---|
| `business_offers` | Novos serviços e produtos; responsável por RPC, leitura pública apenas ativo + perfil público + moderação liberada |
| `offer_areas`, `offer_activities`, `offer_activity_areas` | Catálogo ativo; atividades N:M áreas, com tipo serviço/produto e termos relacionados revisados; leitura pública, sem escrita pelo navegador |
| `offer_images` | Preparação/finalização de mídia própria; foto anterior preservada, nada é adicionado ao portfólio |
| `post_offer_links` | Vínculo opcional de post pessoal/profissional com oferta própria; post profissional exige o mesmo negócio |
| `private.offer_moderation`, `private.offer_audit` | Bloqueio posterior e auditoria, sem aprovação prévia e sem acesso direto pelo cliente |
| Bucket `business-offers` | Privado, WebP real, até 5 MiB por arquivo, metadados preparados antes de inserir; URLs assinadas de 60 segundos |

Os serviços anteriores continuam em `services`, com os mesmos IDs, preços, associações e editor legado. A projeção `offer_rows` os reúne às novas ofertas sem copiar registros. As rotas antigas continuam funcionando. O formulário novo permite classificação por várias atividades; o editor legado dos serviços anteriores continua com sua classificação original. Não existe migração automática entre os dois armazenamentos.

As seis categorias existentes mantêm IDs e nomes. Acrescentam-se seis categorias ausentes, sem atualizar negócios. O catálogo de ofertas oferece 12 áreas, inclusive rótulos ampliados “Construção e reformas” e “Limpeza e conservação”. O cadastro profissional deixa de descartar categorias ativas por uma lista fixa no frontend. Os seis cards ilustrados da Home permanecem intactos.

Produtos são vitrines, sem estoque, carrinho, frete ou checkout. No perfil aparecem até cinco produtos marcados como destaque; os demais ativos podem aparecer na busca. Limites no servidor: 100 ofertas não excluídas/negócio, 20 criações/hora/negócio (incluindo registros depois excluídos), 20 versões de imagem/oferta e 10 atividades/oferta. O lock do negócio serializa quotas/destaques. Não há exclusão física automática de mídia.

## Busca e privacidade

`search_unified` recebe termo, cidade atendida, área, tipo de resultado, tipo de prestador e página; retorna até 21 linhas para paginação de 20. Tudo é a primeira visão. Nome literal recebe peso 100; correspondência por radical do nome 80; atividade explicitamente declarada 60; descrição 30. Usa normalização de acentos e o dicionário português nativo do PostgreSQL. Termos relacionados ficam no catálogo versionado, sem expansão por categoria ampla.

Cidade é filtro de atendimento, não inferência por localização do navegador. Posts pessoais sem cidade pública aparecem somente em “Todas as cidades”. Posts profissionais públicos com negócio privado não revelam a cidade privada: só aparecem sem filtro de cidade. Perfis profissionais podem aparecer pelo próprio nome/profissão ou por suas ofertas explicitamente correspondentes. Não se deduz venda de câmera pela instalação, nem instalação pela categoria Elétrica.

Rascunhos, ofertas inativas/excluídas e negócios privados/suspensos não entram. A função pública faz projeção explícita; não retorna documentos, associação de usuário, WhatsApp privado nem campos legais. Moderação bloqueia leitura pública e reativação pelo autor. O painel existente pode suspender o negócio; `moderate_offer` oferece bloqueio individual auditado, sem uma nova tela administrativa neste PR.

URLs assinadas já emitidas têm validade de até 60 segundos: retirar uma oferta bloqueia novas emissões, mas não revoga retroativamente uma URL ainda válida. Não se armazena resposta privada em service worker/cache público.

## Preflight remoto — somente leitura / dry-run

Projeto exclusivo: `yazdjiwaksamizrbqewq`.
Arquivo: `20261125183249_offers_unified_search.sql`.
SHA-256: `933d7dd5dae28f77cf3e336beeb5932b7ea7b9746ab0fa56f483bfdf57c37937`.

Leitura: última migração remota `20261125131147`; três negócios draft e um publicado; tabelas de ofertas e horários ainda ausentes. Nenhum registro desses foi alterado.

Reconciliação necessária: renomear somente o arquivo local de notificações `20261125125926` para o ID remoto `20261125131147`. Git registra rename 100%. Conteúdo integral comparado desconsiderando apenas whitespace nas extremidades: MD5 `50d55a2ad02d3f70d890e876355ef402`, igual no remoto e local. Nenhum SQL anterior é alterado ou reaplicado.

CLI Supabase 3.4, comando efetivamente executado:

    supabase db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault

Resultado: exclusivamente `20261125183249_offers_unified_search.sql`, sem seeds/roles. Repetir projeto/hash/histórico/dry-run imediatamente antes de eventual aplicação autorizada; parar diante de qualquer diferença.

## Ordem e contenção

1. Avaliar PR e Preview sintético, incluindo telhados/câmera/tinta e cadastro/cancelamento. Sem acesso ao Supabase nessa demonstração.
2. Decisão específica sobre este arquivo/hash/projeto. Não há autorização implícita.
3. Aplicar somente o SQL identificado com aplicador versionado; conferir histórico, RPCs, políticas, bucket privado/limite e registros anteriores em leitura. Não publicar para testar.
4. Homologar no Preview normal com conta legítima e conteúdo consentido: salvar/editar/ocultar, imagem, persistência e isolamento. CI e objetos Storage simulados não provam upload operacional.
5. Integrar código somente após banco validado, checks e aceite do fluxo; confirmar Vercel READY/alias/SHA. Não colocar interface dependente de SQL ausente em produção.

A migração é transacional, aditiva, com lock_timeout de 5s. Falha antes do commit deve reverter sua transação. Não muda funções de publicação, assinatura, isenção, períodos gratuitos ou Asaas. Não altera estados nem conteúdo anterior.

Contenção após aplicação: manter o código anterior enquanto não houver homologação; sem dados novos, simplesmente não integrar a UI. Depois de uso real, preferir correção para frente ou rollback do código que preserve as tabelas/arquivos. Não executar DROP, apagar bucket ou reverter automaticamente o catálogo: novas ofertas/categorias poderiam já estar referenciadas. Qualquer rollback SQL exige revisão/autorização própria. A UI anterior não exibirá as ofertas novas, mas não as apagará.

## Verificações e limites

- Typecheck/build e testes de interface; suíte de regressão exigida pelo CI.
- PostgreSQL 17 descartável, sem Docker: dois usuários, draft/public, RPCs recusadas a terceiros, preço nulo, limite de destaques, atividades/áreas, acentos/plural, cidade, moderação, Storage e vínculo de posts.
- Infraestrutura Auth/Storage no ensaio SQL é simulada. Não é sessão GoTrue ou upload HTTP real.
- Migração pré-existente de notificações depende de Vault/pg_net/Realtime hospedados; não é reexecutada no runner nativo. Esta limitação é explícita e não afeta dependências das ofertas.
- Preview `/qa/offers/` é memória isolada, incluído só em builds Preview com configuração Supabase removida. Seus dados resetam ao recarregar; não representa persistência operacional nem uma conta real.
- Safari/iPhone físico, upload no Storage operacional, nova sessão e conversas entre contas legítimas continuam pendentes. Nenhuma mensagem externa é enviada pelo ensaio.

Caminhos após ativação: Conta → Perfil profissional → Adicionar → Serviço/Produto; editar → Conteúdo → Serviços e produtos; perfil → Serviços/Produtos; publicação própria → Oferta relacionada. Buscar → Tudo/Serviços/Produtos/Profissionais/Projetos. Cada oferta tem página própria e contato na conversa existente.
