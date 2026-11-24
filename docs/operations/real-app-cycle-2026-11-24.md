# Ciclo real — evidência e bloqueios em 24/11/2026

Auditoria direcionada de código e leitura agregada do Supabase, sem publicação, mensagens, alterações de conteúdo ou migrações. Não usa a demonstração #62 como conversa real.

| Etapa | Evidência disponível | Falta / bloqueio exato |
|---|---|---|
| Conta legítima | Ensaios anteriores relatados pelo titular: confirmação, login e persistência; sessão não contornada nesta rodada | Não houve novo ensaio físico nesta auditoria |
| Perfil/serviços | Banco: quatro rascunhos, bio e categoria preenchidas; perfil acompanhado com contato, cidade ativa, três áreas, proprietário habilitado e um serviço ativo. Serviço técnico continua inativo | Aceite do conteúdo legítimo e revisão administrativa; não publicar por inferência de completude |
| Revisão | RPC exige admin, justificativa/estado esperado e requisitos; authenticated não tem UPDATE de status, anon não executa aprovação | Decisão específica identificando negócio; fase inicial gratuita preservada sem consumir os 90 dias |
| Busca | Código consulta negócios publicados, categoria principal/especialidades, cidade atendida e serviços ativos. Seis categorias e sete cidades ativas | Zero publicados: não há perfil real elegível para encontrar publicamente; não é defeito de consulta demonstrado |
| Post | Um post em draft. UFMS não foi convertido, duplicado ou publicado. Público exige post e negócio publicados; prévia privada é separada | Revisão e autorização próprias para negócio e post; nenhum teste público positivo real foi declarado |
| Texto entre duas contas | Zero conversas/mensagens no operacional; tabelas privadas com RLS e RPCs participantes. Abrir conversa exige perfil publicado, sessão habilitada e cliente sem vínculo com negócio | Negócio autorizado publicado e segunda conta legítima distinta disponível. #62 não comprova isso |
| WhatsApp | Código gera somente wa.me com telefone validado, mensagem codificada e link externo seguro; canal existente preservado | Conferir destinatário consentido e abertura no aparelho; nenhum envio realizado |

## Defeito comprovado e corrigido — #67

Uma leitura periódica antiga podia sobrescrever as mensagens recém-confirmadas na UI. Teste reproduziu a perda visual antes da correção; controle de ordem invalida resposta antiga e cleanup de conversa/sessão. Mesma proteção na caixa de entrada. Sem alteração do histórico no banco, RPC, contadores ou visualizado. A regressão é simulada; não equivale a uma conversa remota entre dois usuários.

## Próximo ensaio, somente com decisões correspondentes

1. Titular confere perfil, serviço legítimo/preço, imagens, contato e rascunho UFMS. Nada é publicado ao salvar.
2. Identificar negócio e post e pedir autorização de publicação separada. Admin revisa e registra justificativa; fase gratuita e isenção permanecem. Não iniciar prazo manual.
3. Cliente distinto, não membro do negócio, busca por categoria principal, especialidades e cidades atendidas. Abre perfil/post/serviços corretos.
4. Cliente envia texto; profissional responde. Ambos recarregam, fazem novo login e conferem isolamento. Não solicitar senha, token ou cookie.
5. Abrir WhatsApp para destinatário consentido; eventual envio depende da autorização do participante.

Acesso à conversa em negócio draft é bloqueio intencional do servidor. Nenhum bloqueio foi contornado para antecipar esse ensaio. Avisos financeiros removidos no #66 não foram reintroduzidos.
