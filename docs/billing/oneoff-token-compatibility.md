# Sandbox — compatibilidade do token do webhook Asaas

Os logs da Edge v14 isolaram `webhook_token_format` como única condição do gate que falhou. O validador anterior aceitava apenas `[A-Za-z0-9_-]{32,200}`, enquanto a documentação oficial do Asaas exige 32–255 caracteres sem espaços.

Este ajuste aceita **ASCII visível** `0x21..0x7E` de 32 a 255 caracteres (adequado a tokens de cabeçalho HTTP), sem aceitar espaços, controles ou strings vazias. O token **continua comparado exatamente pelo SHA-256**, antes de ler o corpo, sem downgrade de autenticação.

- Não lê, substitui ou rotaciona o token cadastrado.
- Não altera HMAC, digest, chaves publicáveis, flags, SQL ou Production.
- Adiciona testes para pontuação, 255 caracteres, rejeição de espaços/controles e exigência de correspondência exata.
- **Não implantar nem habilitar o receptor antes de CI/Preview aprovados.** Após o merge, redeploy exclusivo da Edge, flag de recepção temporariamente true e POST com token intencionalmente incorreto: esperar 401; restaurar false.
- Se ainda retornar 503, o problema permanece no formato ou conteúdo do segredo salvo, e deve ser diagnosticado sem registrar qualquer valor.

Documentação: https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web

## Gate do backend Preview — diagnóstico de 28/11/2026

O painel chama `POST /api/admin-oneoff-billing`; o status administrativo calcula disponibilidade pela conjunção de `writeEnabled` e `webhookEnabled`. Os comandos de abertura, autorização e criação recusam `403 DISABLED` se esse gate falhar. O receptor avulso Vercel `/api/asaas-admin-oneoff-webhook` também recusa antes de comparar o header quando `webhookEnabled` é falso. Não confundir esse receptor com a Edge direta.

Em um Preview temporário da branch `feat/oneoff-sandbox`, os logs internos mostraram: ambiente, projeto, branch, URL Supabase, chave publicável, chave Sandbox, HMAC e ambas as flags válidos; token presente, com whitespace ASCII externo; formato antigo inválido, mas formato da Edge válido após normalização. `write_enabled=true` e `webhook_enabled=false`. A chamada com token deliberadamente incorreto retornou `403 DISABLED` antes da autenticação do webhook. Nenhum valor secreto foi registrado.

A correção alinha somente o token Sandbox do backend à política já homologada da Edge: remove `[ \t\r\n]` somente das extremidades do Secret e aceita ASCII visível de 32–255 caracteres. O header recebido não é normalizado pela aplicação e permanece comparado com `timingSafeEqual`, após checagem do tamanho em bytes. Espaços internos, controles, caracteres não ASCII, limites inválidos e tokens iguais ao HMAC ou ao legado continuam rejeitados. A validação de Production permanece inalterada. Não há SQL, mudança de Secret ou abertura automática de janela.

Quatro regressões falharam antes da correção e passaram depois. A suíte focada inclui disponibilidade para administrador legítimo sem criação, flags ausentes, token incorreto, entrada inválida sem persistência, limites/formato e preservação do gate Production. A instrumentação temporária não integra o código final. O teste de gate não homologa checkout, pagamento, entrega Asaas ou conciliação.

Validação HTTP real do patch: o mesmo POST com token deliberadamente incorreto passou de `403 DISABLED` para `401 AUTH_REQUIRED`; os logs internos confirmaram ambas as flags e `webhook_enabled=true` no runtime. O endpoint administrativo sem sessão continuou retornando `401 AUTH_REQUIRED`. Os testes não enviaram evento válido, não criaram solicitação nem abriram janela financeira. A suíte focada passou com 123 testes, typecheck e build. As flags do projeto permanecem ausentes; os overrides dos deployments temporários são removidos pela exclusão desses deployments, após restaurar um Preview limpo. Nenhuma integração à main ou alteração de Production é autorizada por esse diagnóstico.
