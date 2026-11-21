# UI/UX e responsividade — relatório de revisão

Base: `main` em `9e8c5e3e318e77ec877ebbef969228d9ee77fc24`. Branch: `feat/ui-ux-responsividade`.

## Auditoria e implementação

A auditoria precedeu as alterações: páginas públicas, autenticação, Conta, cadastro em três etapas, Espaço Profissional, serviços, fotografias, publicações, gratuidade, Sandbox e todas as seções administrativas; componentes e módulos Sass compartilhados. Foram registradas 20 capturas anteriores (dez telas em 375/1280 px). Identificamos logo completa deixando o cabeçalho alto, categorias desproporcionais, navegação desktop em outra linha, Conta com ícone genérico, perfil sem divisão interna, duplicações de campos/modais e convite PWA imediato.

- Cabeçalho com lettering e til da própria imagem oficial. O símbolo da Conta também é um recorte CSS do arquivo oficial, sem redesenho ou nova fotografia.
- Três abas preservadas. Barra inferior no celular/tablet, marca centralizada e navegação superior a partir de 1024 px; seleção por peso/indicador pequeno, sem fundo amarelo grande.
- Categorias compactas, carrossel com controles próximos, trabalhos com autor/imagem/título/descrição e convite discreto. Nenhuma fotografia pendente foi substituída por imagem de internet.
- Perfil com abas internas Trabalhos/Serviços/Sobre, setas/Home/End e painéis que preservam seus dados. Contatos, serviços, galeria ampliada e publicações continuam utilizando os mesmos repositórios.
- Campos, botões, feedback, tipografia, modais com safe areas e skeleton reutilizável consolidados. Listas de gestão preservam campos e operações; alvos de fotografias têm 44 px e reorganizam-se em telas estreitas.
- Administração com navegação lateral no desktop, trilho no celular, ícones, métricas reais das consultas existentes e tabelas sem expandir a página. Regiões de tabela acessíveis por teclado e orientação para rolagem.
- PWA flutuante em páginas públicas: somente com suporte existente, após 45 segundos **e** interação; oculto em standalone, offline, edição/teclado detectado e foco em ação do conteúdo. Dispensa por 14 dias em preferência local; conta e administração não recebem convite. O diálogo Android depende do evento nativo; iPhone recebe instruções, sem instalação simulada.

## Verificações

| Verificação | Resultado |
|---|---|
| Typecheck | Aprovado |
| Vitest | 388 testes, 33 arquivos aprovados |
| SQL/RLS | Suíte regressiva aprovada em PostgreSQL 17 temporário, sem Docker ou conexão remota |
| Histórico local de migrações | Aprovado; nenhuma migração acrescentada ou aplicada |
| Build Vite/PWA | Aprovado; 11 recursos estáticos no manifesto de cache |
| Layout | 27 telas × 8 larguras = 216 combinações; largura efetiva conferida; nenhum overflow global ou controle cortado fora de regiões deliberadamente roláveis |
| Modais | Editor de serviços nas oito larguras; fotografia em 320×568; paisagem 812×375 com rolagem interna |
| Axe | 54 auditorias de páginas + 5 estados adicionais; zero violações automáticas encontradas |

Larguras: **320, 375, 390, 430, 768, 1024, 1280, 1440 px**. [Matriz](matriz-responsividade.json), [modais](modais.json), [axe](acessibilidade-axe.json) e [interações](interacoes.json).

Foram inspecionados composição, tamanho dos controles, leitura, enquadramento da marca, proporção das categorias, estados vazios, formulários, tabelas e ampliação — além da medição de overflow. O convite final mediu 107 px em 390 px e terminou 11 px acima da navegação. A grade do portfólio passa a uma coluna em 320 px para manter ações confortáveis.

Interações de navegador: empresa nas três etapas sem gravar; criar/editar serviço no repositório em memória; Escape restaura foco; tentativa de fotografia sem arquivo mostra erro; busca com falha sintética recupera no retry; abas por teclado; tabela com rolagem interna; revisão administrativa e instruções iPhone. Os testes automatizados continuam cobrindo autenticação, logout, retornos, concorrência, falhas, gestão, moderação, gratuidade, financeiro e proteções PWA.

## Evidências visuais

| Tela | Antes | Depois |
|---|---|---|
| Home mobile | [375 px](../screenshots/ui-ux/antes-home-375.jpg) | [375 px](../screenshots/ui-ux/depois-home-375.jpg) |
| Administração desktop | [1280 px](../screenshots/ui-ux/antes-admin-1280.jpg) | [1280 px](../screenshots/ui-ux/depois-admin-1280.jpg) |
| Perfil com abas | — | [375 px](../screenshots/ui-ux/depois-perfil-375.jpg) |
| Convite PWA | Seção imediata anterior | [375 px](../screenshots/ui-ux/depois-convite-pwa-375.jpg) |

As capturas são **locais, emuladas e com fixtures sintéticas sinalizadas**. A geometria usada para conferir áreas de imagens não representa fotografias ou registros operacionais. Não foram enviados arquivos ao Storage nem cadastrados prestadores para este trabalho.

## Acessibilidade e desempenho

Abas com tablist/tab/tabpanel, foco móvel, seleção e associação por IDs; foco visível, skip links e cabeçalhos preservados. Modais nativos fecham por Escape e retornam foco. Campos em 16 px evitam zoom automático em iOS; movimento reduzido respeitado. Axe deixou verificações incompletas de contraste de imagens e atributos ARIA em alguns estados: zero violações automáticas não é certificação WCAG. Leituras com VoiceOver/TalkBack permanecem pendentes.

Sem biblioteca de UI, fonte remota ou dependência de produção nova. Bundle principal final: 432,95 kB (129,54 kB gzip), aproximadamente +5,5 kB brutos sobre o publicado; CSS 45,93 kB (8,50 kB gzip), aproximadamente +3,5 kB brutos. Bundle Supabase intacto. Não há medição de Core Web Vitals em dispositivos reais.

## Preservação e limites

Produção conferida `READY`, deployment `dpl_36RsGFF53krEdt3HuKbnFkj3vFNj`, commit-base acima. Nenhum redeploy de produção ou merge nesta tarefa.

Sem alterações em Auth, RPCs, RLS, SQL, rotas de API, publicação, direitos de assinatura, pagamentos ou webhooks. Pix e guardas financeiras permanecem como no PR #17. Service worker/allowlist de cache e guardas de revalidação privada mantidos; testes regressivos passaram. Nenhum acesso de escrita ao Supabase operacional ou Asaas.

**Pendências:** revisão visual no Preview protegido; instalação/abertura e teclado virtual em Android Chrome e iPhone Safari físicos; VoiceOver/TalkBack e zoom nativo. Autenticação/Storage/financeiro neste ensaio foram simulados e os resultados não são apresentados como novas homologações remotas. A configuração de safe areas está preservada no CSS, mas não foi homologada em aparelho com notch.

PR #18 aberto para revisão. Preview Vercel gerado pela branch; sem promoção para produção. Resultados finais de CI vinculados ao PR. Não fazer merge automaticamente.

Na revisão das evidências foi corrigido o fixture local da seção de gratuidades, que não fornecia o resumo exigido pelo contrato. A seção foi reexecutada nas oito larguras e recebeu cobertura de renderização com resumo/tabela sem iniciar gratuidade. Todas as 216 capturas finais têm título renderizado; auditorias axe vazias são rejeitadas na conferência dos artefatos. Não foi necessário alterar a lógica de produção.
