import { Link } from "react-router-dom";
import { ImageIcon } from "lucide-react";
import { TEXT } from "@/lib/typography";
import { useBannerArtBySlot, type ArteDeBanner } from "@/hooks/useBannerArt";
import { BANNER_SLOTS, formatEntrega, type BannerSlot } from "@/lib/bannerSlots";
import { resolverLinkDeBanner } from "@/lib/linkDeBanner";
import { cn } from "@/lib/utils";

const SANGRA = "w-screen max-w-[100vw] ml-[calc(50%_-_50vw)]";
/**
 * Respiro do trio quando ele ocupa a largura da tela.
 *
 * Sem `w-full` aqui: a largura ja vem do `SANGRA` (`w-screen`), e as duas juntas
 * no mesmo elemento se anulam — vence a que o Tailwind emitir por ultimo, e o
 * bloco fica com a largura do container mas ainda deslocado pela margem
 * negativa. Foi o que jogou o terceiro cartao para a linha de baixo.
 */
const TRIO_RESPIRO = "px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12";

/**
 * A medida vem de `bannerSlots.ts`, e nao de uma tabela local.
 *
 * Antes ela morava aqui dentro, entao o admin nao tinha como mostrar o tamanho
 * que cabe em cada espaco — quem preparava a arte dependia do documento de
 * especificacao. Com a lista compartilhada, vitrine e admin leem o mesmo numero.
 *
 * Formato repetido e o que faz o leitor identificar a regiao como area de
 * anuncio, e a partir dai ele pula a regiao inteira: numa medicao da NN/g o
 * numero de fixacoes numa faixa dessas ficou 33 vezes abaixo do que o tamanho
 * dela justificaria. Por isso o par tem proporcao propria (5:2) em vez de
 * repetir a de outra peca.
 */
const MEDIDAS = Object.fromEntries(
  BANNER_SLOTS.map((slot) => [slot.id, slot]),
) as Record<string, BannerSlot>;

export type PromoFormat = "faixa" | "destaque" | "par" | "trio";

function Peca({
  format,
  label,
  arte,
  href,
  radius = "rounded-xl",
  loading = false,
}: {
  format: PromoFormat;
  label: string;
  /** `null` desenha o contorno de "arte aqui" com a medida escrita dentro. */
  arte: ArteDeBanner | null;
  href?: string;
  radius?: string;
  /** Enquanto os banners ainda chegam do banco, so o quadro vazio. */
  loading?: boolean;
}) {
  const medida = MEDIDAS[format];

  const moldura = cn(
    "relative w-full min-w-0 overflow-hidden",
    radius,
    // Com arte de celular, o quadro muda de proporcao junto com ela: a partir de
    // `sm` vale a de desktop. Sem essa troca a arte vertical entraria num quadro
    // deitado e seria cortada nas laterais — exatamente o que ela existe para
    // evitar. Sem arte propria, a proporcao de desktop vale em toda tela.
    arte?.celular ? `${medida.arteDeCelular.aspect} sm:${medida.aspect}` : medida.aspect,
    arte || loading ? "bg-muted" : "border border-dashed border-border bg-muted/30",
    // O trio e o unico bloco em que as pecas competem entre si: tres quadros
    // iguais lado a lado. Levantar a peca sob o cursor diz qual delas o clique
    // vai pegar. `motion-safe` deixa a animacao de fora para quem pediu menos
    // movimento no sistema.
    // O levantar do trio saiu daqui: o bloco clicavel abaixo ja levanta a peca,
    // e as duas regras no mesmo elemento davam translacao dobrada. Peca sem link
    // nao levanta — e correto, ela nao leva a lugar nenhum.
  );

  const conteudo = loading ? null : arte ? (
    <picture>
      {arte.celular ? <source media="(max-width: 640px)" srcSet={arte.celular} /> : null}
      <img
        src={arte.desktop}
        alt={label}
        className="h-full w-full object-cover object-center"
        loading="lazy"
        decoding="async"
      />
    </picture>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center">
      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
      <p className={cn(TEXT.compact, "font-medium text-muted-foreground")}>Arte aqui</p>
      <p className={cn(TEXT.caption, "text-muted-foreground/70")}>
        {label} · {medida.proporcao} · {formatEntrega(medida)}
      </p>
    </div>
  );

  // O link do proprio banner vence o `href` fixo de quem monta a secao.
  const destino = resolverLinkDeBanner(arte?.link) ?? resolverLinkDeBanner(href);

  if (destino && arte) {
    /**
     * Sinal de que o banner leva a algum lugar.
     *
     * O zoom anterior **nunca rodava**. `group-hover:` gera
     * `.group:hover .classe` — a classe precisa estar num **descendente** do
     * grupo, e ela estava no proprio elemento marcado como `group`. O seletor
     * existia no CSS compilado e nao casava com nada: medido no navegador, a
     * imagem ficava em `transform: none` antes e depois do cursor. Sobrava a
     * sombra, que sozinha e quase invisivel. Com `hover:` o seletor vira
     * `.classe:hover img` e casa.
     *
     * A pesquisa do Baymard e direta sobre por que o resto tambem era fraco:
     * "muitos usuarios passam rapido pelo site e nao sao observadores o
     * suficiente para se beneficiar dessas pistas sutis" — cursor, sombra leve e
     * 2% de zoom sao exatamente pistas sutis. Dai o efeito ser bem mais forte
     * agora: 4% na arte, a peca sobe, sombra funda, tudo em hover **unificado**
     * no bloco inteiro (o caso aqui: um link so envolve tudo).
     *
     * **Fica um buraco conhecido no celular.** Nada disso existe sem cursor, e a
     * outra metade da recomendacao do Baymard — um sinal explicito, tipo seta,
     * visivel sem hover — foi retirada por decisao de design. No telefone o
     * banner nao tem nenhum indicio de que e clicavel.
     */
    const afordancia = cn(
      moldura,
      "group block overflow-hidden",
      "transition-[box-shadow,transform] duration-300 ease-out",
      "hover:shadow-[0_18px_44px_rgba(16,24,40,0.20)] focus-visible:shadow-[0_18px_44px_rgba(16,24,40,0.20)]",
      "motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      "[&_img]:transition-transform [&_img]:duration-500 [&_img]:ease-out motion-reduce:[&_img]:transition-none",
      "hover:[&_img]:scale-[1.04] focus-visible:[&_img]:scale-[1.04]",
    );

    return destino.tipo === "interno" ? (
      <Link to={destino.para} viewTransition className={afordancia} aria-label={label}>
        {conteudo}
      </Link>
    ) : (
      <a href={destino.para} target="_blank" rel="noreferrer" className={afordancia} aria-label={label}>
        {conteudo}
      </a>
    );
  }

  return <div className={moldura}>{conteudo}</div>;
}

/**
 * Completa a lista de artes ate o numero de quadros do bloco.
 *
 * O que falta vira `null`, e `null` desenha o contorno tracejado com a medida
 * escrita dentro. Antes entrava aqui um arquivo de exemplo guardado no projeto:
 * a area parecia preenchida sem estar, e nao dava para distinguir arte de
 * verdade de placeholder olhando a pagina.
 */
function completar(artes: ArteDeBanner[], quadros: number): (ArteDeBanner | null)[] {
  return Array.from({ length: quadros }, (_, i) => artes[i] ?? null);
}

export function PromoUnico({
  format,
  label,
  href,
  bleed = false,
  customerType = null,
}: {
  format: PromoFormat;
  label: string;
  href?: string;
  bleed?: boolean;
  customerType?: string | null;
}) {
  const { artes, loading } = useBannerArtBySlot(format, customerType);
  const [arte] = completar(artes, 1);

  return (
    <div className={cn(bleed && SANGRA)}>
      <Peca format={format} label={label} arte={arte} href={href} radius={bleed ? "rounded-none" : "rounded-xl"} loading={loading} />
    </div>
  );
}

export function PromoTrio({
  label,
  customerType = null,
}: {
  label: string;
  customerType?: string | null;
}) {
  const { artes, loading } = useBannerArtBySlot("trio", customerType);
  const quadros = completar(artes, 3);

  return (
    // `SANGRA` sempre, e nao so quando pedido. O trio fica dentro do container da
    // pagina, entao qualquer `max-w` maior que os 1680px do container nao teria
    // efeito nenhum — o pai ja limitou. Para a banda passar dos 1400 e preciso
    // primeiro sair do container pela margem negativa, e so entao impor o teto
    // proprio, mais largo, la embaixo.
    <div className={cn(SANGRA, TRIO_RESPIRO)}>
      {/* `grid-cols-3` puro, e nao coluna de largura arbitraria.
          Tentei com `repeat(3, 380px)` e depois com `repeat(3, minmax(0,380px))`,
          e as duas quebravam: coluna com medida propria briga com a largura
          disponivel, e quando nao cabe o terceiro cartao desce para a linha de
          baixo. Aqui quem manda e a linha — a grade divide o que houver em tres
          partes iguais, entao os tres ficam sempre na mesma reta.
          O tamanho do cartao se controla pelo teto da linha (`max-w`), nao pela
          coluna: em 1880px cada um fica com 611px.

          1880 e nao 1680: sao 100px para cada lado alem do container, o bastante
          para o bloco descolar do alinhamento do texto sem virar sangria ate a
          borda — esta reservada as pecas unicas (topo e destaque final). Fileira
          de tres colada na borda perde o eixo com o resto da pagina. */}
      <div className="mx-auto grid w-full max-w-[1880px] grid-cols-1 gap-6 sm:grid-cols-3">
        {quadros.map((arte, i) => (
          <Peca key={i} format="trio" label={`${label} · ${i + 1}`} arte={arte} loading={loading} />
        ))}
      </div>
    </div>
  );
}

export function PromoDuo({
  label,
  bleed = false,
  customerType = null,
}: {
  label: string;
  bleed?: boolean;
  customerType?: string | null;
}) {
  const { artes, loading } = useBannerArtBySlot("par", customerType);
  const quadros = completar(artes, 2);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", bleed && SANGRA)}>
      {quadros.map((arte, i) => (
        <Peca key={i} format="par" label={`${label} · ${i + 1}`} arte={arte} loading={loading} />
      ))}
    </div>
  );
}
