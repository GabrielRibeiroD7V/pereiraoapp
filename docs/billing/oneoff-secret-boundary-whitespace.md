# Ajuste restrito de whitespace do Secret Sandbox

O diagnóstico remoto v31 identificou `webhook_token_format`, mesmo após ampliar a validação para 32–255 caracteres ASCII visíveis. A auditoria anterior confirmou quebra de linha nas extremidades e formato válido depois de removê-la.

O receptor agora remove **apenas** espaço ASCII, tab, CR e LF das extremidades do segredo de servidor antes de verificar o formato. **Não** modifica o token recebido no cabeçalho HTTP, não aceita espaços internos e preserva a comparação de digest exata e anterior à leitura do corpo.

Esta alteração elimina erros comuns de colagem sem criar, alterar ou divulgar o segredo. Testes cobrem LF/CRLF externos, token incorreto→401, token correto→ACK simulado, espaços internos e Unicode rejeitados.

**Sem mudanças em HMAC, digest, banco, credenciais, flags, Production ou webhook legado.** Após CI, implantar somente Edge avulsa inicialmente desligada, validar remoto com token incorreto e, se aprovado, manter a flag desativada até autorização para recepção. Não criar pagamentos.
