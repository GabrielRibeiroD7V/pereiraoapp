# PR #35 — aceitação da bio pelo titular

Status: código revisado e CI aprovado no PR #35; persistência real **não homologada**.
O titular deve executar os passos no Preview vinculado ao PR #35, não na produção atual.
Nenhuma bio anterior pode ser reconstruída a partir de um `description` nulo.

1. Entrar com a conta legítima diretamente no Preview. Não compartilhar senha, código ou sessão.
2. Na Conta, selecionar o negócio correto e abrir **Editar perfil e bio**. Deve abrir a etapa da descrição.
3. Digitar a apresentação legítima desejada; avançar e conferir o texto na revisão, incluindo acentos e quebras de linha.
4. Salvar o rascunho. Deve voltar à Conta do mesmo negócio, exibir a bio e manter status draft.
5. Recarregar normalmente a Conta: a bio deve continuar.
6. Sair e entrar novamente; abrir a Conta e a edição. Conferir o mesmo conteúdo nos dois lugares.
7. Informar apenas sucesso ou a etapa/erro, sem credenciais. Com o ID do negócio confirmado, conferir em leitura a presença de `businesses.description`, sem reproduzir seu conteúdo no relatório.

Critério de aceite: revisão, gravação, recarga e novo login preservam a bio do mesmo negócio; não há duplicação, publicação ou início de gratuidade.
Não interpretar testes com repositório simulado como confirmação de uma gravação no Supabase real.

Falhas: registrar rota, etapa e horário, sem texto pessoal ou token. Não apagar armazenamento do navegador como solução.
O PR de foto principal depende do PR #35; não faz seu merge nem afirma que essa aceitação já ocorreu.
