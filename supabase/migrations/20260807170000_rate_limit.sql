-- Contador de uso das rotas /api/*, exigido pela §21 do padrao de autenticacao.
--
-- ## Por que no Postgres, e nao em memoria
--
-- As rotas rodam em funcao serverless: cada invocacao pode cair numa instancia
-- diferente, e instancia fria comeca zerada. Um contador em memoria limitaria
-- uma instancia por vez — ou seja, nao limitaria nada. O estado precisa ser
-- compartilhado, e o Postgres ja esta ali.
--
-- ## Por que uma funcao, e nao SELECT seguido de UPDATE
--
-- Ler o contador e depois grava-lo abre corrida: duas chamadas simultaneas leem
-- o mesmo valor e ambas passam. `insert ... on conflict do update` resolve tudo
-- numa instrucao so, atomica por linha, e o `returning` devolve ja o valor novo.
--
-- ## Janela fixa, e nao deslizante
--
-- Janela fixa deixa passar ate 2x o limite na virada (fim de uma janela + inicio
-- da seguinte). Isso e conhecido e aceito aqui: o objetivo e barrar script e
-- abuso, nao cravar vazao exata. Janela deslizante custaria uma linha por
-- chamada em vez de uma por chave.

create table if not exists "clinic+b2b_rate_limit" (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contagem integer not null default 0
);

comment on table "clinic+b2b_rate_limit" is
  'Contador por chave (rota:dimensao:valor) das rotas /api/*. Escrito apenas pela funcao consumir_rate_limit, com service role.';

-- Sem politica: RLS ligada e nenhuma policy significa que anon e authenticated
-- nao leem nem escrevem nada. O service role passa por cima da RLS, e e o unico
-- que precisa. Deixar a tabela legivel exporia o padrao de uso de cada conta.
alter table "clinic+b2b_rate_limit" enable row level security;

/**
 * Consome uma unidade da chave e devolve o estado da janela.
 *
 * `security definer` porque a tabela e fechada por RLS. O `search_path` fixo
 * evita que um schema plantado no caminho sequestre a resolucao de nomes dentro
 * de uma funcao que roda com os privilegios do dono.
 */
create or replace function consumir_rate_limit(
  p_chave text,
  p_janela_segundos integer
)
returns table (contagem integer, segundos_na_janela integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contagem integer;
  v_inicio timestamptz;
begin
  insert into "clinic+b2b_rate_limit" as r (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set
      -- Janela vencida reinicia o contador em 1 (esta chamada); janela viva soma.
      contagem = case
        when r.janela_inicio < now() - make_interval(secs => p_janela_segundos) then 1
        else r.contagem + 1
      end,
      janela_inicio = case
        when r.janela_inicio < now() - make_interval(secs => p_janela_segundos) then now()
        else r.janela_inicio
      end
  returning r.contagem, r.janela_inicio into v_contagem, v_inicio;

  return query
    select v_contagem, greatest(0, extract(epoch from (now() - v_inicio))::integer);
end;
$$;

-- A funcao roda com privilegio elevado. Aberta a `anon`/`authenticated`, qualquer
-- pessoa poderia queimar a cota de outra conta so chutando a chave — o contador
-- viraria a arma em vez da defesa.
revoke all on function consumir_rate_limit(text, integer) from public;
revoke all on function consumir_rate_limit(text, integer) from anon;
revoke all on function consumir_rate_limit(text, integer) from authenticated;
grant execute on function consumir_rate_limit(text, integer) to service_role;

-- Linha de chave inativa nao serve para nada depois que a janela vence. Sem
-- limpeza a tabela cresce para sempre; com indice por janela, apagar e barato.
create index if not exists "clinic+b2b_rate_limit_janela_idx"
  on "clinic+b2b_rate_limit" (janela_inicio);
