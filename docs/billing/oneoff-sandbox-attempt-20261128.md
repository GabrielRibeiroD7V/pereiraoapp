# Homologação Sandbox — 28/11/2026

O Preview com o gate corrigido pelo #111 reconheceu as flags temporárias e a sessão administrativa legítima. Foi registrada uma única autorização Pix de R$ 19,90 para o pagador Sandbox existente e consentido.

Uma única tentativa de criação chegou ao Asaas. O log oficial de requisições comprovou `POST /api/v3/checkouts`, HTTP 400, `invalid_object`: “O campo name só pode conter no máximo 30 caracteres.” O nome enviado era “PEREIRÃO — teste administrativo avulso”. A resposta não forneceu checkout. Nenhum segundo POST foi executado.

A correção utiliza “PEREIRÃO — teste avulso” e valida o limite antes de transmitir a criação. O teste de regressão cobre o payload Pix/cartão e rejeita o nome antigo antes de qualquer chamada HTTP.

A solicitação permanece `uncertain` / `creation_uncertain`, sem checkout ou pagamento, preservada para auditoria. A conciliação por leitura foi executada e não encontrou pagamento correspondente. Não há permissão para reiniciar automaticamente essa tentativa: a proteção de unicidade por ambiente/modalidade permanece intacta. A recuperação de uma rejeição definitiva deve ser revisada separadamente, com vínculo à mesma solicitação e sem liberar repetição em casos de timeout ou resultado desconhecido. Não alterar diretamente o registro ou apagar auditoria para liberar a cota.

A janela Sandbox foi fechada; a recepção voltou a false; ambas as flags temporárias da branch foram removidas; o Preview foi reimplantado sem elas. Production, credenciais, HMAC, webhook legado e contratos não foram alterados.

Pagamento simulado, entrega de evento, deduplicação remota e conciliação financeira positiva não foram executados ou aprovados. Nenhuma movimentação real foi realizada.
