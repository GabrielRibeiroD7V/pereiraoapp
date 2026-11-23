# Erro real de envio de retrato — 22/11/2026

O titular confirmou uma tentativa no Preview normal, pelo Chrome desktop.
O seletor e a prévia abriram; confirmar envio exibiu erro. Não é homologação
Safari nem envio concluído. A imagem privada não foi copiada para este PR.

## Evidência operacional em leitura

- prepare: HTTP200 e um metadado pending.
- finalize inicial:22023, esperado enquanto não existe objeto.
- upload Storage:HTTP400, PostgreSQL42501 em
  private.guard_profile_image_object, linha da validação de responsável.
- finalize de conciliação:22023; zero objetos no bucket e sem pointer no negócio.
- As requisições tinham um único ator authenticated; o erro do banco ocorreu
  com o login supabase_storage_admin. Não foram consultados tokens ou cookies.
- Portfólio do negócio continua sem esse retrato. Nada foi excluído/publicado.

## Causa e correção proposta

O Storage faz teste de RLS como chamador e persiste usando sua conexão interna.
Seu fluxo está documentado no código oficial:
https://github.com/supabase/storage/blob/master/src/storage/uploader.ts
O trigger assumia que auth.uid() sempre corresponderia ao usuário também na
persistência interna. Reproduzimos42501 ao retirar a claim do usuário nessa fase.

20261123000107_fix_profile_storage_guard.sql muda somente essa função. Mantém
metadado pending e lock; chamador normal continua can_manage_business. Sem UID,
aceita apenas sessão real de banco supabase_storage_admin em papel interno
service_role/storage_admin. Nessa fase exige owner_id/owner emitido pelo Storage,
UUID válido, conta ativa, membership owner/admin e negócio não suspenso.
Não confia em user_metadata/JWT de cliente para escolher papel privilegiado.
Não altera RLS, grants do Storage, bucket, MIME, limite, finalização, publicação
ou finanças. A seleção de papel exige session_user de banco, não campo da API.

owner_id é lido por to_jsonb(NEW), com fallback owner, sem depender do tipo de
uma coluna específica. Ausência de responsável é erro, nunca autorização livre.
A finalização continua autenticada e valida tamanho/MIME antes de trocar foto.

## Testes e autorização

O runner SQL executa a reprodução antes desta migração e os cenários após ela.
PostgreSQL17 temporário nativo, sem Docker. Foram testados upload interno válido,
finalização pelo chamador, owner incorreto/ausente, terceiro normal, papel de
serviço sem login Storage e fase authenticated sem usuário. Os testes anteriores
mantêm isolamento, dados e foto anterior. Testes locais não são upload real.

A migração NÃO foi aplicada remotamente. A autorização anterior era exclusiva
para business_presentation, já aplicada. Esta correção precisa de autorização
específica. Não editar/reaplicar a migração original de retratos.

## Retomada e contenção

Preservar o pending existente e a aba com a seleção, se ainda aberta. Não limpar
metadado nem pedir outra imagem antes de resolver a causa. Após autorização:
preflight histórico/hash/dry-run exclusivo; aplicar apenas esta correção; conferir
função/políticas/dados em leitura. Se a aba mantiver a seleção, a nova tentativa
usa o mesmo ID/caminho, sem criar outro retrato. Confirmar objeto/ready/pointer,
recarga e novo login antes de considerar o upload homologado ou liberar merges.
Sem autorização, manter bloqueio, não desabilitar o trigger nem alargar políticas.
