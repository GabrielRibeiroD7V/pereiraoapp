# Destinos de Web Push — auditoria de 27/11/2026

A RPC de inscrição autentica o usuário, mas só limita o comprimento do endpoint. A Edge Function implantada encaminha esse valor ao `web-push` sem validar o destino. Uma inscrição maliciosa pode provocar uma requisição de saída para um endereço escolhido pelo usuário quando houver mensagem. Isso é risco de SSRF, não prova de acesso bem-sucedido a uma rede interna.

A correção limita o envio a HTTPS/443, sem credenciais, fragmentos ou caracteres ambíguos, nos hosts de Apple, Google/FCM, Mozilla e WNS. Um provedor novo exige revisão explícita. A validação acontece antes da chamada de envio; destinos recusados não são apagados e não contam como entregues. O timeout é de dez segundos. O cliente continua sem acesso aos segredos VAPID e ao segredo interno do receptor.

Fontes primárias para a lista:
- Apple: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.md (`*.push.apple.com`).
- Google: https://firebase.google.com/docs/cloud-messaging/network-configuration e https://developer.chrome.com/blog/web-push-interop-wins (FCM/GCM).
- Mozilla: https://mozilla-services.github.io/autopush-rs/http.html.
- Microsoft: https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config (`*.notify.windows.com`).

Validação: 26 testes locais de destinos permitidos, IP local/metadata, hosts parecidos, credenciais, porta, fragmentos, comprimento e falha de envio. Nenhum dispositivo ou envio Push real foi usado. Não comprova entrega física.

Não há migração ou modificação de inscrições existentes. Este PR não implanta a Edge Function: o deploy da função `message-push` no projeto `yazdjiwaksamizrbqewq` é uma etapa separada após revisão. O merge/deploy Vercel não atualiza essa função. Antes de ampliar o beta com Push, validar a função corrigida e os dispositivos consentidos. Nenhuma ação de Asaas pertence a este procedimento.

Pendências separadas: revogação da inscrição ao sair em dispositivo compartilhado, vínculo por conta ao mostrar “Notificações ativadas”, limitação de inscrições e retry durável de falhas transitórias. A fila atual descarta exceções e a Edge responde 200 com a contagem entregue; isso não garante entrega de todas as notificações.
