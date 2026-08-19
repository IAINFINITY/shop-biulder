-- Prazo de guarda para cada tabela com dado pessoal, e o expurgo que o cumpre.
--
-- ## Por que existe
--
-- O art. 16 da LGPD manda eliminar o dado apos o termino do tratamento, salvo
-- hipotese de guarda. Ate aqui nenhuma tabela tinha prazo: `auth_events` crescia
-- para sempre, `rate_limit` acumulava janela vencida, conversa de suporte nao
-- tinha fim, e a funcao de limpeza de dispositivos existia desde
-- `20260808220000` sem que nada a chamasse. Guardar para sempre "porque um dia
-- pode ser util" e exatamente o que o art. 15 nao permite.
--
-- ## Os prazos, e de onde vem cada um
--
--   pedido ............ 5 anos  fisco pode cobrar tributo da nota nesse prazo
--                               (CTN, arts. 173 e 174). Menos cria risco fiscal;
--                               mais nao tem justificativa. A escrituracao fiscal
--                               vive no Proxsys — aqui e copia de conveniencia
--   conversa .......... 2 anos  cobre reclamacao de consumidor (CDC, art. 27)
--   trilha de acesso .. 1 ano   investigar incidente exige historico, nao
--                               historico eterno
--   rate limit ........ 1 dia   janela vencida nao serve para nada
--   dispositivo ....... 90 dias apos expirar, ja era regra da propria tabela
--
-- Favorito, endereco e perfil nao entram: morrem junto com a conta, por FK.
--
-- ## Medido antes de instalar
--
-- Em 19/08/2026, contra producao: o expurgo apagaria 52 linhas de `rate_limit` e
-- **nada mais** — nenhum evento, conversa, pedido ou dispositivo atingiu prazo.
-- O projeto e novo demais para isso. E a melhor hora para instalar a regra: ela
-- passa a agir sozinha quando o dado envelhecer, sem ninguem precisar lembrar.

-- ---------------------------------------------------------------------------
-- O expurgo, com relatorio do que fez.
-- ---------------------------------------------------------------------------
--
-- Uma funcao so, e nao uma por tabela, porque o agendamento e um so e o
-- relatorio precisa sair junto. Devolve linha por regra para dar para conferir
-- o efeito sem abrir o log do cron.

create or replace function public.clinic_b2b_expurgo_por_retencao()
returns table (regra text, removidos integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  delete from public."clinic+b2b_rate_limit"
   where janela_inicio < now() - interval '1 day';
  get diagnostics v = row_count;
  regra := 'rate_limit'; removidos := v; return next;

  delete from public."clinic+b2b_auth_events"
   where ocorrido_em < now() - interval '1 year';
  get diagnostics v = row_count;
  regra := 'auth_events'; removidos := v; return next;

  -- A conversa leva as mensagens junto, por `on delete cascade`.
  delete from public."clinic+b2b_support_conversations"
   where last_message_at < now() - interval '2 years';
  get diagnostics v = row_count;
  regra := 'support_conversations'; removidos := v; return next;

  delete from public."clinic+b2b_orders"
   where created_at < now() - interval '5 years';
  get diagnostics v = row_count;
  regra := 'orders'; removidos := v; return next;

  -- Ja existia desde `20260808220000`; o que faltava era alguem chamar.
  select public.clinic_b2b_limpar_dispositivos_confiaveis() into v;
  regra := 'dispositivos_confiaveis'; removidos := v; return next;
end;
$$;

comment on function public.clinic_b2b_expurgo_por_retencao() is
  'Aplica os prazos de guarda do art. 16 da LGPD. Roda pelo pg_cron, diariamente. Devolve o que apagou, por regra.';

-- Ninguem alem do dono executa: e `security definer` e apaga dado.
revoke all on function public.clinic_b2b_expurgo_por_retencao() from public;
revoke all on function public.clinic_b2b_expurgo_por_retencao() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agendamento.
-- ---------------------------------------------------------------------------
--
-- 03:00 UTC e meia-noite em Brasilia: fora do horario de uso, e antes do
-- movimento do dia seguinte. `unschedule` antes de agendar para a migration
-- poder rodar de novo sem duplicar o job.

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('clinic-b2b-expurgo-retencao');
exception
  when others then null; -- ainda nao existia; seguir
end;
$$;

select cron.schedule(
  'clinic-b2b-expurgo-retencao',
  '0 3 * * *',
  $$select public.clinic_b2b_expurgo_por_retencao()$$
);
