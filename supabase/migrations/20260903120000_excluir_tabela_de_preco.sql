-- Excluir uma tabela de preço, e não só desativar.
--
-- ## O pedido
--
-- "Poder excluir uma tabela. Hoje só dá para desativar, e sem a opção de
-- excluir acaba tendo uma poluição visual muito grande."
--
-- Procede: tabela desativada continua na lista para sempre. Quem cria uma para
-- testar fica com ela pendurada, e a lista deixa de responder "quais tabelas
-- existem" para responder "quais já existiram".
--
-- ## Por que uma função, e não um DELETE do navegador
--
-- Apagar uma tabela são **duas** remoções: os preços dela em
-- `clinic+b2b_customer_price_overrides` e a linha em `clinic+b2b_price_tables`.
-- Não há transação no cliente Supabase — se a primeira passasse e a segunda
-- falhasse, sobraria uma tabela sem preço nenhum, e ninguém saberia por quê.
-- Aqui as duas caem juntas ou nenhuma cai.
--
-- ## ⚠️ Recusa quando alguém depende dela
--
-- Duas dependências, e as duas mudam preço na cara do cliente sem aviso:
--
-- - um **tipo de conta** apontando para ela (`customer_types.price_table_id`);
-- - uma **conta** com negociação individual (`customer_profiles.proxis_tpr_id`).
--
-- Nesses casos a resposta é o erro, e não o silêncio: quem clicou precisa saber
-- que a tabela está em uso, e por quem. Desativar continua sendo o caminho para
-- tirar da frente sem quebrar quem depende.
--
-- A checagem existe no banco e não só na tela porque a tela pode estar com dado
-- velho — o tipo pode ter sido apontado para a tabela um segundo atrás, por
-- outra pessoa.

create or replace function public.clinic_b2b_excluir_tabela_de_preco(p_tpr_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_tipos text[];
  v_contas integer;
  v_precos integer;
begin
  if not public.clinic_b2b_is_internal_staff() then
    raise exception 'Sem permissão para excluir tabela de preço.'
      using errcode = '42501';
  end if;

  select name into v_nome
    from public."clinic+b2b_price_tables"
   where tpr_id = p_tpr_id;

  if v_nome is null then
    raise exception 'Tabela % não existe.', p_tpr_id using errcode = 'P0002';
  end if;

  select coalesce(array_agg(name order by name), '{}')
    into v_tipos
    from public."clinic+b2b_customer_types"
   where price_table_id = p_tpr_id;

  select count(*) into v_contas
    from public."clinic+b2b_customer_profiles"
   where proxis_tpr_id = p_tpr_id;

  if array_length(v_tipos, 1) > 0 or v_contas > 0 then
    raise exception 'Tabela % está em uso: % tipo(s) e % conta(s).',
      p_tpr_id, coalesce(array_length(v_tipos, 1), 0), v_contas
      using errcode = 'P0001';
  end if;

  -- A ordem importa pouco aqui porque é tudo uma transação só, mas os preços
  -- saem primeiro para que, num banco sem esta função, o mesmo roteiro à mão
  -- não deixe preço órfão apontando para tabela inexistente.
  delete from public."clinic+b2b_customer_price_overrides"
   where proxis_tpr_id = p_tpr_id;
  get diagnostics v_precos = row_count;

  delete from public."clinic+b2b_price_tables" where tpr_id = p_tpr_id;

  return jsonb_build_object('tpr_id', p_tpr_id, 'nome', v_nome, 'precos_removidos', v_precos);
end;
$$;

revoke all on function public.clinic_b2b_excluir_tabela_de_preco(integer) from public;
grant execute on function public.clinic_b2b_excluir_tabela_de_preco(integer) to authenticated;

comment on function public.clinic_b2b_excluir_tabela_de_preco(integer) is
  'Apaga uma tabela de preço e os preços dela, numa transação. Recusa se algum tipo de conta ou alguma conta depender dela.';
