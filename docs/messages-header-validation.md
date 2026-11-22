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
