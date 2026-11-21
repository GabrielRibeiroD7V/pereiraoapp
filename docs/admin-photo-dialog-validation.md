# Correção da ampliação de fotografias na administração

Na revisão de uma fotografia, o modal é renderizado dentro da figura da miniatura. Os seletores amplos `.admin-photo-grid button` e `.admin-photo-grid img` também atingiam o botão de fechar e a imagem ampliada. O fechamento herdava largura total e proporção 4:3, aumentando o cabeçalho; a imagem ampliada herdava o recorte `cover` da miniatura.

Os estilos agora ficam restritos ao botão filho direto da figura e à imagem desse botão. O modal preserva o botão de 44 × 44 px e a imagem ampliada com `object-fit: contain`, sem alterar componentes, permissões ou dados.

## Validação

- Defeito observado na interface publicada, com sessão administrativa legítima, consultando uma fotografia técnica preexistente. Nenhum perfil foi publicado e nenhum registro foi alterado.
- Correção inspecionada em navegador desktop com viewports emulados de 375, 390, 768 e 1280 px. Em todas: botão 44 × 44 px, cabeçalho de 44 px, imagem carregada em `contain` e ausência de overflow horizontal da página.
- Captura local com dados sintéticos: `screenshots/admin/photo-dialog-fixed-375.png`. O harness temporário foi removido antes do commit; não há dados operacionais ou credenciais na captura versionada.
- Typecheck, testes automatizados, SQL/RLS e build conferidos; os resultados finais e o CI estão descritos no PR. Não foram adicionados testes que apenas reproduzam os seletores CSS; a regressão visual foi verificada pelas dimensões computadas e captura do modal.

A pendência externa de variável Asaas Sandbox em Production não faz parte desta alteração. Nenhuma migração, configuração Vercel ou integração financeira é alterada por este PR. A correção aguarda revisão, sem merge ou deploy de produção nesta tarefa.
