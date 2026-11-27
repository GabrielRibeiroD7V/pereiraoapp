# Banners interativos da Home — PR #101

Os dois PNGs foram fornecidos pelo titular. Conversão **WebP sem perdas**, sem redesenho, recorte, resize, texto ou botão sobreposto. A comparação dos pixels decodificados foi idêntica. Dimensões originais: 2172 × 724 (3:1). Metadados/hashes: [home-banner-assets.json](home-banner-assets.json).

| Imagem | PNG original | WebP sem perdas |
|---|---:|---:|
| Encontrar profissionais | 2.018.153 bytes | 1.447.942 bytes |
| Divulgar negócio | 1.814.978 bytes | 1.293.052 bytes |

Redução total aproximada de 28,5%, preservando todos os pixels. Sem nova dependência no aplicativo. Primeiro banner com `fetchPriority=high`; segundo já montado com `loading=eager` e prioridade baixa, carregado antes da transição. Ambos têm width/height definidos e frame 3:1 reservado. Nenhum overlay; os indicadores ficam abaixo.

## Rotas e retomada

| Ação | Rota existente e efeito |
|---|---|
| Banner 1 inteiro | `/buscar`, público e sem exigir login. |
| Banner 2 inteiro | `/conta/profissional`, entrada profissional já existente. |
| Sem sessão | Guard existente encaminha para `/entrar?next=%2Fconta%2Fprofissional`; “Criar conta” conserva o mesmo `next`. Callback/confirmacão continuam no mecanismo Auth existente. |
| Sem negócio | A entrada profissional agora leva diretamente ao formulário existente `/conta/profissional/cadastro`; não cria registro ao abrir. |
| Com negócio/draft | Retoma `/conta/profissional/:businessId/perfil` com as ações existentes. Respeita negócio da navegação/checkpoint do titular antes do primeiro da lista. Nenhum novo negócio é criado. |
| Consulta falha | Mostra o erro existente; não presume ausência do negócio nem inicia criação. |

O antigo convite textual da Home foi removido por redundância. Categorias, nomes, destinos, busca e navegação permanecem no mesmo escopo do #101.

## Comportamento

- Rolagem horizontal nativa e snap, deslize nos dois sentidos, indicadores acessíveis de 44px com ponto ativo ciano; setas do teclado e links reais.
- Alternância a cada 6 segundos, somente após as duas imagens terminarem de carregar para evitar trocar para uma imagem vazia em rede lenta, reiniciando o intervalo depois da interação. Pausa com dedo/drag, mouse sobre o banner, foco dentro da região ou documento em segundo plano.
- Movimento reduzido desliga a alternância automática e a rolagem animada, preservando navegação manual.
- Deslocamento/cancelamento de gesto impede o clique gerado pelo arraste; um novo toque intencional funciona. Drag de mouse também suportado.
- Timers, listener de visibilidade, listener de preferência e ResizeObserver são limpos na desmontagem.
- Sem alterações em sessão, Storage, Supabase, cobrança ou service worker. Imagens públicas seguem os headers existentes (`must-revalidate`); não há cache de dados privados nem limpeza de armazenamento. Não precacheia 2,7MB durante a instalação do worker.

## Validação executada

- 16 testes novos: clique público, autenticação e retorno, cadastro de conta com `next`, titular sem negócio, negócio em draft/publicado, retomada de negócio lembrado, timers, limpeza, pausa, movimento reduzido, scroll, teclado e prevenção de navegação por swipe.
- Suite final: **945 testes**, typecheck e build aprovados. SQL/RLS local completo aprovado, sem Docker. Não há comando de lint configurado no package.json; `git diff --check` passou.
- Chromium local com viewport/touch emulados: 320/360/375/390/393/430/768/1024/1280/1440px, frame 3:1 sem overflow e grade 4 × 3 preservada. Deslize nativo nos dois sentidos sem navegar, clique real da superfície para Buscar/login e alternância em 6s exercitados pelo motor do navegador.
- Autenticação/cadastro nos testes usam adapters sintéticos locais. Não houve login, cadastro, gravação de negócio ou publicação em nome do titular.
- A suíte existente de PWA e navegação permaneceu aprovada. **Safari físico e PWA instalada no iOS/Android não foram executados nesta rodada.** Emulação e mocks não são aceite em aparelho.

## Capturas da interface implementada

Capturas locais em Chromium, com dados sintéticos explicitamente identificados e tráfego externo bloqueado; banners são as próprias imagens fornecidas.

- [Home 320px](screenshots/home-twelve/home-320.png), [Home 393px](screenshots/home-twelve/home-393.png), [Home desktop](screenshots/home-twelve/home-1440.png).
- [Segundo banner 393px](screenshots/home-twelve/banner-second-393.png), [segundo banner desktop](screenshots/home-twelve/banner-second-1440.png).

## Conferência física posterior

No Preview do #101: abrir Home → tocar no primeiro banner (Buscar sem login) → voltar → deslizar para o segundo sem sair da Home → tocar na imagem/botão desenhado (login ou perfil profissional existente) → voltar. Conferir também 6s sem interação e pausa durante o toque. Repetir no navegador e pelo ícone PWA instalado, quando disponíveis. Sem cadastrar ou publicar algo para testar o banner.

Sem migração, merge ou deploy Production. A atualização gera apenas o Preview automático da integração GitHub–Vercel já autorizada. Aprovação do titular continua necessária para integrar.
