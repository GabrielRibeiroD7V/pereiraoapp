# Recuperação da rejeição por cadastro incompleto — Sandbox

## Evidência e cadastro

O único POST da rodada anterior recebeu HTTP 400 no log Asaas Sandbox `108278750`: faltavam `phone`, `address`, `addressNumber`, `postalCode`, `province` e `city`. A referência externa coincide com a solicitação `dd279b98-de7c-4eeb-8253-fd95e2564bc4`. O nome do item já estava correto. Não houve checkout retornado nem evento; o pagador está sem cobranças.

O responsável autorizou completar **o mesmo pagador Sandbox**. O cadastro identificado como teste foi atualizado pela interface oficial, preservando ID, nome, documento, e-mail, referência externa e notificações desabilitadas. Foram usados endereço de exemplo/identificação explícita de Sandbox e telefones de teste, sem envio de mensagens. O formulário rejeitou o primeiro formato de telefone de exemplo; nenhum salvamento foi assumido antes da confirmação de sucesso. Phone e mobilePhone são campos distintos: ambos foram conferidos após recarga, pois o formulário classifica automaticamente números móveis.

Fontes oficiais:
- https://docs.asaas.com/reference/atualizar-cliente-existente
- https://docs.asaas.com/docs/como-informar-os-dados-do-cliente

A validação real final deve consultar GET customer e GET payments no Preview autenticado, sem abrir janela ou habilitar criação. A resposta do aplicativo expõe somente prontidão/nomes de campos, não os dados do pagador.

## Correção preventiva

Antes de reivindicar a criação (`start`), o servidor consulta o pagador e valida os seis campos exigidos e notificações desabilitadas no Sandbox. Cadastro incompleto falha com `PAYER_INCOMPLETE`, sem consumir a tentativa, chamar POST ou registrar incerteza. O provider repete a validação antes do POST para impedir uso direto com dados inválidos. Falhas após reivindicação continuam conservadoras, sem retry automático.

O painel atualiza o estado do servidor também após erro para não manter a ação de criar visível a partir de uma cópia antiga em estado authorized.

## Nova recuperação proposta — não aplicada

Arquivo: `20261128054927_admin_oneoff_payer_rejection_recovery.sql`.
Projeto: `yazdjiwaksamizrbqewq`.

Cria apenas RPC e índice de auditoria, sem DML operacional na aplicação. Não modifica a migração ou RPC da recuperação anterior. A nova transição é exclusiva do log 108278750 e da mesma solicitação/pagador/instante de criação/Pix1990. Exige duas reivindicações anteriores e exatamente uma recuperação anterior do nome. Não libera qualquer resposta 400.

Exige HMAC Sandbox existente, administrador original confirmado, nonce e validade, janela fechada, nenhuma lease/evento/checkout/pagamento, consulta vazia completa de pagamentos e prova de cadastro validado com até 60 segundos. Auditoria própria `payer_rejection_recovered` com índice único; repetição imediata é idempotente, mas não permite outra recuperação depois de nova tentativa incerta.

Preserva ID, consentimento, valor, created_at e unicidade. Renova apenas a validade operacional por uma hora e registra prova, estado/validade anteriores e nova validade. Não abre janela, não cria checkout ou assinatura e não altera a gratuidade.

## Sequência e contenção

1. Revisar SQL/hash, histórico e dry-run exclusivo. Obter autorização específica antes da aplicação.
2. Aplicar somente a migração autorizada e validar histórico, definição, privilégios e índice em leitura.
3. Na sessão administrativa original do Preview protegido, validar pagador e referência; confirmar somente a recuperação. Conferir mesma solicitação authorized, consentimento preservado e uma nova auditoria.
4. Manter flags ausentes, receiver false e janelas fechadas. Criação posterior exige etapa/autorização próprias e não é realizada nesta preparação.

Contenção: não habilitar criação ou recepção; fechar janelas; se houver defeito, revogar acesso à nova RPC por procedimento revisado. Não apagar índices/auditoria nem restaurar o estado por UPDATE manual. A RPC antiga permanece compatível. Sem a nova migração, a inspeção funciona; recuperar retorna SETUP_REQUIRED sem transição parcial.

## Testes

Node/UI: campos ausentes/malformados, proteção de dados da resposta, preflight antes de start/POST, referência exata, inexistência de pagamento e uso exclusivo da nova recuperação. SQL/RLS local: prova, administrador original, Production recusada, cadastro e consulta frescos, rejeição exata, janela/lease/eventos bloqueantes, recuperação única/idempotente e preservação do consentimento/auditoria/initial_free. Não equivalem a pagamento ou entrega de webhook homologados.
