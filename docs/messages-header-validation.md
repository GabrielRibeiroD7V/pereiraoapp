# Acesso global às mensagens

O cabeçalho compartilhado oferece um único atalho para `/mensagens` em Início,
Buscar, perfis e Conta. O atalho duplicado da Conta foi removido. As três abas
principais continuam Início, Buscar e Conta. A caixa mantém a autenticação e o
retorno de login existentes; WhatsApp e Instagram públicos não ganham barreiras.

Não há contador de não lidas: o modelo atual não persiste leitura por participante.
Não houve alteração de banco, regras de mensagens, status ou finanças.

O layout conserva colunas laterais iguais e a marca central. No celular, a cidade
continua na segunda linha e o botão de mensagens tem alvo de 44 × 44 CSS px. No
desktop, cidade e botão dividem a coluna direita. Isto é verificação de código;
layout físico Safari/Android e acionamento com leitor de tela ainda dependem de
aceitação no dispositivo. Nenhuma captura sintética foi apresentada como real.

## Verificações desta alteração

- Seis novos testes: quatro telas com atalho único e três abas; visitante retorna
  ao login sem consultar conversas; usuário simulado abre a caixa autenticada.
- Regressão direcionada: navegação pública, Conta e mensagens — 26 testes.
- Typecheck, suíte automatizada, build e verificação local do histórico.
- Testes usam repositórios em memória; não enviam mensagens nem criam pessoas.
- Supabase, somente leitura: zero conversas/mensagens; RLS nas duas tabelas
  privadas; quatro RPCs de mensagens com EXECUTE autenticado e sem EXECUTE anônimo.
- Troca real entre cliente e profissional depende de perfil publicado com
  consentimento e autorização administrativa próprios; não executada neste PR.

## Aceitação no Preview

1. Em Início, Buscar, um perfil e Conta, conferir o ícone, foco e área de toque.
2. Como visitante, tocar no ícone: Entrar; após login, caixa de mensagens.
3. Com conta legítima, abrir a caixa e conferir os estados reais, sem inventar
   conversas ou contagens. Sair e verificar que o conteúdo privado não aparece.
4. Conferir em 320, 393 e 1280 px a marca central e ausência de sobreposição;
   validar no Safari/iPhone e Android separadamente de testes jsdom.

PR independente de #36/#38, baseado na main. Ao atualizar a base de #38, preservar
este atalho e não restaurar o duplicado no toolbar de Conta. Sem merge autorizado.

## Revisão após a integração da vitrine profissional

Base de produção: `2fbabb90241d12c4d263d7fcdba1e803eddc908c`.

- Removido também o botão local Mensagens do perfil próprio: o acesso global
  compartilhado já atende essa tela. O CTA de contato com outro profissional
  permanece no perfil público, assim como o WhatsApp.
- A caixa não anuncia ausência de conversas quando o repositório está indisponível.
- Erro de leitura oferece Tentar novamente; nova sessão ou nova tentativa limpa a
  lista anterior e mostra carregamento antes do resultado.
- Seis regressões novas cobrem perfil próprio sem duplicata, carregamento, vazio,
  indisponibilidade, erro/retomada e retorno a conversa/início após autenticação.
- 39 testes direcionados de cabeçalho, mensagens, central e persistência de serviços
  passaram, além de typecheck e build. São testes locais com repositórios em memória.
- Preview real: navegação anônima pelo ícone abriu Entrar com next=/mensagens.
  Capturas desktop e emulação iPhone 16 393×852 foram realizadas no Chrome.
  Não houve login, envio de mensagem nem alteração operacional nesta revisão.
- A troca operacional entre duas contas continua pendente; depende de um negócio
  legitimamente publicado com autorização própria. CI não substitui esse ensaio.
