-- Tipo de cliente "funcionario" ausente, e o efeito colateral disso na
-- visibilidade dos produtos.
--
-- O codigo trata `funcionario` como tipo de primeira classe (esta em
-- `CUSTOMER_TYPES`, em `CUSTOMER_TYPE_LABELS`, e o painel filtra por ele para
-- separar equipe de cliente), mas a linha nunca foi criada na tabela.
--
-- Sintoma visivel: o campo "Visivel para" do formulario de produto mostrava as
-- vezes quatro tipos e as vezes tres. Nao era por produto — o `useCustomerTypes`
-- comeca com quatro tipos padrao e depois troca pelo que vem do banco.
--
-- Sintoma pior, relatado pelo time de design: faltavam categorias na arvore de
-- filtros para quem nao e admin. A regra `podeVer` considera "marcou todos"
-- equivalente a "nao marcou nenhum" comparando o `visible_to` do produto com a
-- lista de tipos existentes — e essa lista oscilava entre 3 e 4.

-- 1. Unicidade em `name`, que faltava.
--
-- A tabela so tinha chave primaria em `id` (uuid), entao nada impedia dois
-- "cliente". Duplicata quebraria justamente a regra acima: `todosOsTipos`
-- teria o mesmo nome duas vezes e a comparacao com o `visible_to` do produto
-- passaria a depender de qual linha veio primeiro.
--
-- Indice sobre `lower(trim(name))` porque o codigo normaliza assim na leitura —
-- unicidade so no texto cru deixaria passar "Cliente" ao lado de "cliente".
-- Verificado antes: nao ha duplicata hoje, entao o indice sobe sem conflito.
create unique index if not exists clinic_b2b_customer_types_name_uidx
  on public."clinic+b2b_customer_types" (lower(trim(name)));

-- 2. O tipo que faltava.
--
-- Sem `on conflict`: o indice acima e sobre uma expressao, e `on conflict` com
-- expressao exige repetir a expressao inteira. O `where not exists` diz a mesma
-- coisa e se le melhor.
insert into public."clinic+b2b_customer_types" (name)
select 'funcionario'
where not exists (
  select 1 from public."clinic+b2b_customer_types"
  where lower(trim(name)) = 'funcionario'
);

-- 3. Quem ja marcava todos os tipos continua marcando todos.
--
-- **Esta parte nao e opcional.** Ao existir um quarto tipo, os produtos marcados
-- com os tres atuais deixariam de ser "marcou todos" e virariam restritos —
-- sumiriam para quem nao e admin e nao tem tipo de cliente (visitante deslogado,
-- conta interna sem perfil), levando junto as familias deles da arvore de
-- filtros. Sao 33 produtos hoje.
--
-- So mexe em quem tem os tres tipos atuais: produto restrito de proposito
-- (marcado com um ou dois) fica como esta.
update public."clinic+b2b_clinic_catalogo_front_b2b"
set visible_to = visible_to || array['funcionario']
where visible_to is not null
  and 'cliente' = any(visible_to)
  and 'lojista' = any(visible_to)
  and 'distribuidor' = any(visible_to)
  and not ('funcionario' = any(visible_to));
