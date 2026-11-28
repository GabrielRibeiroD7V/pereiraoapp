# Sandbox — compatibilidade do token do webhook Asaas

Os logs da Edge v14 isolaram `webhook_token_format` como única condição do gate que falhou. O validador anterior aceitava apenas `[A-Za-z0-9_-]{32,200}`, enquanto a documentação oficial do Asaas exige 32–255 caracteres sem espaços.

Este ajuste aceita **ASCII visível** `0x21..0x7E` de 32 a 255 caracteres (adequado a tokens de cabeçalho HTTP), sem aceitar espaços, controles ou strings vazias. O token **continua comparado exatamente pelo SHA-256**, antes de ler o corpo, sem downgrade de autenticação.

- Não lê, substitui ou rotaciona o token cadastrado.
- Não altera HMAC, digest, chaves publicáveis, flags, SQL ou Production.
- Adiciona testes para pontuação, 255 caracteres, rejeição de espaços/controles e exigência de correspondência exata.
- **Não implantar nem habilitar o receptor antes de CI/Preview aprovados.** Após o merge, redeploy exclusivo da Edge, flag de recepção temporariamente true e POST com token intencionalmente incorreto: esperar 401; restaurar false.
- Se ainda retornar 503, o problema permanece no formato ou conteúdo do segredo salvo, e deve ser diagnosticado sem registrar qualquer valor.

Documentação: https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web
