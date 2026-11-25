# Capacidade para o lançamento do PEREIRÃO

## Medição inicial — 25/11/2026

Projeto `yazdjiwaksamizrbqewq` na organização `pereirao`, plano Free, ativo. Consulta somente em leitura: banco 16.398.003 bytes (aproximadamente 16 MB), 2 contas, 4 negócios, 5 objetos, 516.110 bytes no Storage. O tráfego de saída, usuários ativos mensais e consumo de e-mails **não foram medidos** nesta consulta; verificar Usage no painel. Esses números mudam com o uso.

O aplicativo já limita cada original JPEG/PNG/WebP a 10 MB, reduz a dimensão maior a 1600 px e converte para WebP antes do upload; o arquivo preparado tem limite de 5 MB. Publicações aceitam até seis fotos. Não reduzir automaticamente a qualidade com base apenas nos limites teóricos: medir arquivos reais e latência no iPhone antes de mudar esse pipeline.

## E-mail de cadastro, prioridade antes de convidar usuários

O Auth permanece no Supabase, com confirmação obrigatória. O SMTP padrão é de teste e pode bloquear cadastros; usar provedor de e-mail transacional com domínio remetente verificado. Não há segredo de SMTP neste repositório.

1. Definir um domínio controlado pelo PEREIRÃO e um provedor SMTP transacional. Verificar o domínio no provedor e publicar os registros DNS exigidos (SPF/DKIM e, quando recomendado, DMARC).
2. No painel Supabase do projeto correto, configurar Auth → SMTP com remetente da marca, host, porta e credenciais do provedor. Não alterar as credenciais em código ou expor valores em logs.
3. Manter Confirm email ativado. Em Auth → Email Templates, aplicar `docs/auth-email/confirm-signup.html` e `docs/auth-email/reset-password.html`, ajustando os assuntos para “Confirme seu e-mail | PEREIRÃO” e “Redefina sua senha | PEREIRÃO”. Os templates usam o `{{ .ConfirmationURL }}` do Supabase e não coletam tokens no app.
4. Conferir Site URL e allowlist **exata** do callback `https://pereirao.vercel.app/auth/retorno`. Testar cadastro novo, recebimento, clique, login e recuperação em duas caixas de e-mail sob controle legítimo; verificar spam e erros de entrega no provedor. O aplicativo mantém mensagem neutra para recuperação de conta.
5. Ajustar limites e alertas de envio segundo os recursos do provedor. Não aumentar indiscriminadamente nem desativar a confirmação para contornar o bloqueio.

Essas configurações do Auth são operacionais; um merge do repositório, por si só, **não** ativa SMTP nem altera os templates remotos.

## Acompanhamento

Rodar `scripts/monitor-capacity.sql` periodicamente para banco, objetos e contas. No dashboard Supabase Usage conferir separadamente Storage, egress, cached egress, MAU e erros de Auth. Registrar data e valores; investigar crescimento inesperado de imagens, conversas ou consultas. Para fins de planejamento, revisar capacidade ao chegar a aproximadamente 50% de qualquer limite e decidir o upgrade antes de 80%, considerando tendências e picos. Os percentuais são gatilhos operacionais propostos, não limites oficiais.

## Plano Pro

O plano Pro começa em US$ 25/mês na tabela pública, sujeito a custo adicional conforme uso e configurações. A compra depende de revisar a estimativa e o método de pagamento da organização `pereirao` no painel. Agendar a mudança **antes** de uma divulgação que eleve o tráfego, após SMTP e testes do fluxo real. O upgrade não corrige consultas lentas por si só: acompanhar logs e índices. Não comprar um plano para outra organização Supabase.

Referências oficiais: https://supabase.com/pricing · https://supabase.com/docs/guides/auth/auth-smtp · https://supabase.com/docs/guides/auth/auth-email-templates
