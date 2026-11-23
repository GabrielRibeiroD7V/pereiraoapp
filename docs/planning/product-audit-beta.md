# Produto: estado e sequência após aee25db

Auditoria por código, não prova de operação publicada. Produção confirmada no commit aee25db51aa850dde96aa705cd70ca865f12ea16. #40 (categorias), #45 (preparação) e #46 (enquadramento) integrados. Titular aprovou o enquadramento básico no iPhone; isso não homologa pinça #47, instalação #44, mensagens #39, upload/persistência ou ciclo publicado. #39/#44 atualizados sobre a main; #47 já deriva dela. Preview temporário combina apenas essas três entregas e nunca deve ir para produção como conjunto.

## Existe / parcial / falta

| Item | Estado verificado | Evidência e limite |
|---|---|---|
| Profissão declarada separada da categoria | Falta em produção; proposta neste PR | Novo campo profession da apresentação; não altera categories/business_categories. Para empresa representa atuação declarada, não profissão pessoal de integrante. Sem selo. |
| Título profissional/empresa | Existe | presentation.headline, edição e prévia; rótulos distintos para autônomo/empresa. |
| Bio | Existe | businesses.description, cadastro/edição/prévia/perfil público. Não é substituída pela profissão. |
| Experiência/formação/certificações/registro | Existe, autodeclarado | PresentationEditor/PresentationSections, seções opcionais. Não há processo de verificação de credenciais. |
| LinkedIn | Falta em produção; proposta neste PR | URL HTTPS opcional de /in/ ou /company/; edição e identidade pública/privada; migração pendente. |
| Texto em conversas | Existe no código/banco; homologação real parcial | RPCs open_conversation/send/my_conversations/my_conversation_messages, acesso restrito a participantes; falta ciclo com duas contas e negócio autorizado publicado. #39 melhora descoberta/estados. |
| Fotos no chat | Falta | Mensagens têm apenas id, conversation_id, sender_id, body, created_at. Nenhum upload/anexo de conversa. |
| Confirmação de leitura | Falta | Sem cursor/estado por participante; polling não significa leitura. #39 deliberadamente não cria contador fictício. |
| Visitas/ações de interesse | Falta para métricas confiáveis | Sem eventos/ingestão/deduplicação/relatórios de visitas. Contagens locais de projetos/fotos/serviços na prévia não são analytics. |
| Avaliações de cinco estrelas | Falta | Tipo RatingSummary legado não equivale a cadastro, evidência de atendimento, moderação ou agregação operacional. UI pública não inventa notas. |
| Renomado/destaque | Falta | Sem critérios aprovados, processo de reputação, janela ou amostra mínima; não há selo a conceder. |
| Publicações no perfil e Trabalhos recentes | Existe no código; homologação pública parcial | work_posts/imagens/RPCs e PublishedWorks; publicação intencional, negócio publicado e mídia ready. Portfólio não vira post automaticamente. Nenhum negócio publicado na leitura desta rodada. |
| Convite profissional quando houver posts | Existe | Home: cabeçalho/pesquisa → categorias → profissionais → PublishedWorks → convite “É profissional ou tem uma empresa?”. O convite é uma seção normal, não flutuante; Carregar mais trabalhos adiciona itens acima e o desloca para baixo. Continua presente com/sem posts; não há regra para ocultá-lo quando o titular já é prestador. |

Profissão declarada ainda não participa do filtro nem da RPC de busca textual: este PR não muda os critérios de busca. A busca atual usa nome/bio, categorias/especialidades, cidades atendidas e serviços ativos. Eventual busca por profissão deve ser um módulo posterior explícito, após ativar e validar os campos.

## Ordem de módulos pequenos e critérios de aceite

0. **Fechar os acessos e foto existentes** (#39/#44/#47). Usar uma passagem física no Preview conjunto; registrar três resultados e três decisões separados. iPhone: Home/pin/mensagens, instalação com um toque, arraste/pinça. Android: prompt nativo apenas disponível, gestos e retorno. Desktop: mouse, Ajustes por teclado, navegação. Não repetir o aceite básico #46 nem confundir simulação com dispositivo físico.
1. **Ciclo público real, prioridade operacional**. Preparar um serviço legítimo (nenhum novo serviço técnico), revisar dados e fotos. Publicar apenas o negócio identificado com consentimento/autorização administrativa. Cliente legítimo sem vínculo encontra por categoria principal/adicional e cidade atendida, inicia texto; profissional responde. Ambos recarregam/entram novamente e confirmam histórico. WhatsApp com destinatário consentido, distinguindo abrir o app de entregar mensagem. Antes de publicação: prévia privada/serviço/contatos/permissões; conversa nova exige published. Não iniciar 90 dias para testes; a publicação autorizada segue a regra já existente e a isenção.
2. **Profissão e LinkedIn** (este PR, independente). Revisar expansão e autorizar aplicação separadamente. Antes disso, testar só demonstração sintética e compatibilidade do formulário existente. Depois da ativação, sessão legítima edita/salva/recarrega/prévia; visitante só lê negócio publicado. iPhone/Android: teclado URL, texto longo, voltar ao mesmo negócio; desktop: teclado, link externo seguro. Nunca mostrar alteração não salva como publicada. Busca por profissão fica explicitamente fora deste PR.
3. **Fotos nas conversas**, depois de homologar texto e revisar modelo/permissões abaixo. Aceite em cada plataforma: seleção/prévia/cancelamento, falha/repetição sem duplicação, isolamento e leitura autorizada. Nenhum dado real sem consentimento.
4. **Leitura e caixa de entrada**, separado de anexos. Aceite: apenas abrir conteúdo visível em primeiro plano avança cursor; receber/polling não marca visualizado; offline não inventa confirmação; isolamento nas três plataformas.
5. **Métricas**, após definir eventos e privacidade. Aceite: reconciliação de eventos reais, exclusão de visitas próprias, deduplicação/rate limit, rótulos de incerteza, agregados isolados. Nenhum contador sem fonte auditável.
6. **Avaliações e eventual destaque**, somente após definir elegibilidade, abuso e moderação. Aceite: nota 1–5 persistida/legítima, impedimento de autoavaliação, transparência de amostra e moderação, critérios aprovados antes de qualquer selo. Não presumir que conversa prova serviço concluído.

## Modelos preliminares — NÃO são migrações autorizadas

### Anexos de conversa

Tabela privada conversation_attachments: id, conversation_id, message_id, sender_id, object_path, mime, bytes, media_state(pending/ready/failed), created_at. Bucket privado próprio; caminhos vinculados à conversa. RPCs de preparação/finalização vinculam usuário real e mensagem à conversa correta. Apenas participantes habilitados, conforme conversation_actor; remetente não pode escolher identidade/negócio alheio. Assinaturas de URL curtas, sem cache público. Cliente valida e otimiza; servidor valida formato/tamanho/estado antes de disponibilizar. Riscos: acesso depois de remoção/suspensão até expirar URL, conteúdo sensível/EXIF, arquivos órfãos, anexos duplicados e moderação. Definir retenção e limpeza por API de Storage, nunca DELETE SQL em storage.objects. Não reutilizar bucket público/portfólio para mensagens.

### Leitura

Tabela privada conversation_participant_reads: conversation_id + user_id (chave), last_read_message_id e read_at servidor. Participante só avança seu cursor, para mensagem realmente pertencente à conversa; avanço monotônico com ordenação estável. Outra parte só lê confirmação da própria conversa. “Visualizado” descreve exposição em tela, não prova compreensão humana. Riscos: privacidade, relógios/clientes mentirosos, troca de conta, offline, mensagens fora de ordem; política de opt-out deve ser decidida antes da implementação.

### Métricas

Eventos privados mínimos: business_id, tipo(view/contact_click/whatsapp_open/conversation_created), timestamp servidor, identificador opaco limitado para deduplicação e origem técnica validada. Agregados por negócio/dia acessíveis apenas ao responsável/admin; não expor visitante, telefone, bio, token ou URL assinada. conversation_created pode derivar do backend; clique/abertura de WhatsApp não prova mensagem enviada ou venda. Visitas anônimas são estimativas com bots, não pessoas garantidas. Riscos: fraude de eventos anônimos, rastreamento, reidentificação e custos. Aprovar retenção, finalidade e limites antes de tabelas/SDKs.

### Avaliações

business_reviews: business_id, reviewer_id, rating inteiro 1–5, texto limitado, elegibility_reference, moderation_state e timestamps; auditoria privada de alterações/moderação. Precisará de definição de evidência de atendimento: o PEREIRÃO ainda não tem contratação/serviço concluído verificável. Bloquear proprietário/equipe se autoavaliando e duplicatas indevidas; regras para resposta, recurso e edição. Dados pessoais não públicos. “Renomado” só com regra aprovada e versionada (nota, amostra mínima, janela, autenticidade e contestação), sem inventar valores ou converter campo autodeclarado em selo. Riscos reputacionais, fraude por contas múltiplas e seleção enviesada; nenhum destaque implementado agora.

Nenhum destes modelos futuros cria tabelas, números, estrelas, visualizado, selos ou cobranças nesta rodada.
