# Home: 12 destaques, catálogo de 16 e auditoria de cadastro

Escopo isolado de #99, #95 e #96. Vinculado à issue #100. O anexo mais recente prevalece sobre a descrição anterior da issue: **12 cards, quatro colunas e três linhas**, mantendo as 16 opções no catálogo completo.

## Correções e implementação

- A Home lia seis categorias de uma configuração fixa, enquanto os filtros/cadastro já liam 16 do banco. Agora seus destaques também dependem do catálogo ativo recebido do Supabase, sem nomes/opções inventados em fallback. A lista editorial contém somente a ordem de 12 IDs; não limita cadastro, busca ou edição.
- `HomeCategories` compartilha a mesma resposta com “Ver todas as categorias”, evitando uma consulta concorrente redundante para o mesmo catálogo. Carregamento, erro e catálogo vazio têm estados próprios; falha não anuncia opções antigas como ativas.
- 12 destaques: os seis originais e Segurança eletrônica, Energia solar, Hidráulica, Eventos e decoração, Materiais e ferramentas, Tecnologia. As outras quatro continuam integralmente disponíveis em “Ver todas”, filtros, cadastro, edição e busca.
- Seis SVGs próprios adicionais (câmera/escudo, painel solar, tubulações, decoração/bolo, caixa de ferramentas e computador/código). Os quatro SVGs de #94 continuam existentes; as seis ilustrações originais têm hashes preservados, testados byte a byte.
- Grade compacta 4 × 3, tipografia e hifenização em português, alvos ≥44px, mesmo fundo/bordas/cores. Logo, navegação, links e feed preservados. Não modifica o catálogo remoto.

## Matriz e evidências

| Verificação | Evidência / limite |
|---|---|
| 16 categorias × autônomo/empresa | 32 casos de interface completos: escolha, descrição, adicional, contato, gravação de rascunho, sem publicação. Repositório sintético de interface. |
| Persistência e autorização | 32 combinações em PostgreSQL nativo temporário: RPC real de criação, proprietário, dados, áreas, especialidades, alteração/removal, leitura após troca de claims, rejeição de terceiro, publicação/retirada local, busca principal/adicional/cidade e nenhuma assinatura/ativação. ROLLBACK ao final. |
| Entrada inválida | Categoria inexistente/inativa, adicionais duplicadas, principal repetida como adicional, isolamento entre contas: testes SQL. Validações de WhatsApp, Instagram, CNPJ opcional, nome/cidade e navegação existentes preservadas. Sem exigências profissionais novas. |
| Busca | Testes de 16 IDs, URLs, filtros, paginação e histórico em busca antiga/unificada. Rascunhos e suspensão permanecem protegidos. |
| Segurança remota | Leitura somente: 16 categorias ativas, RLS ligado em businesses/business_categories/business_service_areas/business_details/categories/cities. Quatro negócios (3 draft, 1 publicado), zero assinaturas. Nenhum dado foi alterado. |
| Dispositivo | Chromium local emulado em 320, 375, 390, 393, 430, 768, 1024, 1280, 1440px: grade 4 × 3, marca central, quatro abas, catálogo completo acessível por teclado, cadastro/edição sem overflow. Não é Safari/Android físico. |
| Novo login real | Não executado: claims SQL testam RLS, mas não reproduzem GoTrue, sessão de navegador ou persistência em aparelho. Não foram criados cadastros fictícios em produção. |

Script visual: `QA_OUTPUT=../../outputs/home-twelve-pr100 node scripts/categories-catalog-qa.mjs`. Bloqueia tráfego externo e usa catálogo/contas exclusivamente locais. Script SQL não aceita URL remota, inicia PostgreSQL via socket e encerra o cluster; não usa Docker.

### Capturas implementadas, com dados sintéticos identificados

- Home: [320px](screenshots/home-twelve/home-320.png), [393px](screenshots/home-twelve/home-393.png), [1440px](screenshots/home-twelve/home-1440.png).
- Todas as categorias: [393px](screenshots/home-twelve/categories-open-393.png).
- Cadastro: [celular](screenshots/home-twelve/registration-393.png), [desktop](screenshots/home-twelve/registration-1280.png).
- Edição: [celular](screenshots/home-twelve/editing-393.png), [desktop](screenshots/home-twelve/editing-1280.png).

## Banco e implantação

**Nenhuma migração nova é necessária.** As 16 categorias já existem e foram confirmadas em leitura. O único SQL novo neste PR é teste local, não migração. Não alterar IDs nem copiar SQL financeiro. Integração depende de revisão/decisão do titular; sem merge automático.

O histórico financeiro remoto apresenta IDs de #95/#96 diferentes dos arquivos locais, com hashes de conteúdo iguais. Isso é uma pendência separada de reconciliação antes de novos `db push`; esta Home não tenta repará-la e não precisa executar SQL. #99 documenta o bloqueio de seu próprio dry-run.

## Homologação ainda humana

Aceite de legibilidade da grade 4 × 3 no iPhone físico e Android; novo cadastro/login real e cancelamento em aparelho, com titular consentido. Capturas emuladas e testes locais não equivalem à validação operacional. Nenhum conteúdo, conta, conversa ou cobrança foi criado em produção.
