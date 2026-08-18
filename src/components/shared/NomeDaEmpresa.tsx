import { nomeSemCnpj } from "@/lib/empresarioIndividual";
import { cn } from "@/lib/utils";

/**
 * O nome da empresa como ele deve aparecer na plataforma.
 *
 * Resolve duas coisas que vieram juntas no pedido do cliente:
 *
 * **1. O número na frente do nome.** Empresário Individual não escolhe razão
 * social — a Receita monta uma colando a raiz do CNPJ no nome da pessoa
 * (`66.121.553 JOSE FRANCISCO DE ARAUJO NETO`). Como o nome vem da API e é
 * exibido em destaque, esses clientes ficavam com um número à frente. O número
 * sai daqui: ele já aparece em campo próprio, completo, em todo lugar onde
 * este componente é usado.
 *
 * **2. O identificador de MEI.** Sai de `is_mei`, gravado a partir da Receita —
 * nunca deduzido do nome. Dos três Empresários Individuais do cadastro, dois
 * são MEI e um não é, todos com o mesmo formato de razão social; deduzir pelo
 * texto colocaria um rótulo errado ao lado do nome de um cliente real.
 *
 * `isMei` aceita `null`/`undefined` de propósito: significa "ainda não
 * consultamos", e nesse caso não há selo. Só `true` mostra.
 */
export function NomeDaEmpresa({
  company,
  cnpj,
  isMei,
  className,
  fallback = "—",
}: {
  company: string | null | undefined;
  cnpj: string | null | undefined;
  /** `true` mostra o selo. `false`/`null`/`undefined` não mostram. */
  isMei?: boolean | null;
  className?: string;
  /** O que exibir quando não há nome. */
  fallback?: string;
}) {
  const nome = nomeSemCnpj(company, cnpj);

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{nome || fallback}</span>
      {isMei === true ? <SeloMei /> : null}
    </span>
  );
}

/**
 * O selo.
 *
 * `shrink-0` para o selo nunca ser comido pelo `truncate` do nome — num nome
 * longo, o pedaço que some tem de ser do nome, não a informação que o cliente
 * pediu para conseguir enxergar.
 *
 * `title` porque "MEI" é sigla: quem não conhece passa o cursor e descobre.
 */
export function SeloMei({ className }: { className?: string } = {}) {
  return (
    <span
      title="Microempreendedor Individual"
      className={cn(
        "shrink-0 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5",
        "text-[0.625rem] font-semibold uppercase leading-none tracking-[0.08em] text-primary",
        className,
      )}
    >
      MEI
    </span>
  );
}
