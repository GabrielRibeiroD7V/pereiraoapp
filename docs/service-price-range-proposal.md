# Faixa de preços — proposta separada, não implementada

Os três modos atuais continuam fixed, starting-at e quote. O valor de serviço é
cobrado pelo prestador, não é a assinatura da plataforma. quote sempre grava
price_amount_cents NULL e não mostra campo/valor numérico.

Faixa exige mudança de contrato e CHECK existente: novo tipo range, campos
price_min_cents / price_max_cents (inteiros não negativos, máximo >= mínimo),
ambos obrigatórios somente em range; price_amount_cents NULL nesse modo. Nos
três modos antigos, min/max devem ser NULL. Exibição: “De R$ X a R$ Y”, com
condições na descrição; ausência de valor nunca significa grátis.

Antes de um PR próprio: definir se mínimo igual ao máximo será permitido e
limite monetário. Preparar migração versionada expansiva e compatibilidade para
clientes antigos, que hoje só reconhecem três modos. Não habilitar range antes
de todos os leitores serem compatíveis. Aprovação de SQL e aplicação remota
serão decisões próprias. Este PR não adiciona colunas, tipo ou opção de faixa.
