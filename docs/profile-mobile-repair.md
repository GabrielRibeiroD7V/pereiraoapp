# Perfil e menus em viewport pequena

Causa no código: menu Adicionar absoluto, min-width 13rem e sem contenção na viewport. Substituído por diálogo nativo top-layer, com links do mesmo negócio; três ações próximas em grade de três colunas, sem menu flutuante que ultrapasse a borda. Identidade flexível, foto circular proporcional e quebra de textos longos. Contatos configurados aparecem como círculos verde/roxo com nomes acessíveis; destinos preservados.

Modal acompanha VisualViewport (altura, largura e offsets), incluindo resize/scroll por teclado/barra do navegador. Cabeçalho/fechar fora do corpo rolável, ações sticky dentro do corpo. Safe areas preservadas. Removidos números de resumo potencialmente incompletos (projetos vinham somente da primeira página); nenhum contador substituto foi inventado.

Sem SQL, mudança operacional, publicação ou finanças. 22 testes direcionados passaram (menu/retorno, viewport/teclado simulado e instalação). Typecheck e build de Preview. Conferência visual emulada não comprova Safari físico; não foram recebidas nesta mensagem as três capturas novas mencionadas pelo titular.

Roteiro: Conta → perfil → Adicionar; conferir três opções, Fechar e retorno. Em Editar/qualquer modal, abrir teclado e rolar corpo sem perder título/fechar/ações. Testar 320, 375, 390, 393, 430 e desktop, também com textos longos. Upload de publicações será PR dependente, com mídia separada e migração proposta.
