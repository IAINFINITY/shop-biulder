# Prazos de guarda

Decidido em 19/08/2026. Implementado e rodando.

O art. 16 da LGPD manda eliminar o dado depois que o tratamento termina, salvo
hipótese de guarda. Este arquivo diz, por tabela, **quanto tempo** e **por quê** —
e o que executa a regra.

## A tabela

| Onde | Prazo | De onde vem o prazo |
|---|---|---|
| `orders` | 5 anos | O fisco pode cobrar tributo relativo à nota nesse prazo (CTN, arts. 173 e 174). Menos que isso cria risco fiscal; mais não tem justificativa |
| `support_conversations` (e as mensagens, por cascata) | 2 anos | Cobre o prazo de reclamação do consumidor (CDC, art. 27) |
| `auth_events` | 1 ano | Investigar incidente exige histórico, não histórico eterno |
| `rate_limit` | 1 dia | Janela vencida não serve para nada |
| `dispositivos_confiaveis` | 90 dias após expirar | Já era regra da própria tabela desde `20260808220000` |
| `customer_profiles`, `customer_addresses`, `customer_favorites`, `product_reviews` | enquanto a conta existir | Somem com ela, por chave estrangeira |

## O que executa

`clinic_b2b_expurgo_por_retencao()`, agendada no `pg_cron` como
`clinic-b2b-expurgo-retencao`, **diariamente às 03:00 UTC** — meia-noite em
Brasília. Criada na migration `20260819160000_retencao_e_expurgo.sql`.

A função devolve uma linha por regra com quantos registros apagou, então dá para
conferir o efeito sem abrir o log do agendador:

```sql
select * from public.clinic_b2b_expurgo_por_retencao();
select jobname, schedule, active from cron.job where jobname = 'clinic-b2b-expurgo-retencao';
```

## Medido antes de instalar

Contado contra produção em 19/08/2026, antes de agendar: o expurgo apagaria
**52 linhas de `rate_limit`** e nada mais. Nenhum evento, conversa, pedido ou
dispositivo tinha atingido prazo — o projeto é novo demais.

A primeira execução confirmou exatamente isso: 52 em `rate_limit`, zero em todo
o resto. É a melhor hora para instalar uma regra de retenção — ela passa a agir
sozinha quando o dado envelhecer, sem depender de alguém lembrar.

## O que este arquivo não resolve

**O pedido também vive no Proxsys.** O que o expurgo apaga é a cópia daqui. A
escrituração fiscal é de lá, e o prazo de guarda do ERP é assunto do contador,
não deste repositório.

**Backup do Supabase tem retenção própria**, definida no plano contratado. Apagar
a linha da tabela não apaga a linha do backup — o dado sai de vez quando o backup
que o contém expira. Vale conferir no painel qual é esse prazo e registrar aqui.
