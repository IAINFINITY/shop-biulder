import { describe, expect, it } from "vitest";
import { AFORDANCIA_DE_BANNER } from "@/lib/afordanciaDeBanner";
import { cn } from "@/lib/utils";

/**
 * A moldura de uma peça do catálogo, como `PromoBanners` a monta.
 *
 * Reproduzida aqui em vez de importada porque ela é montada dentro do
 * componente, a partir da medida do slot. O que interessa ao teste é a forma:
 * uma moldura que declara raio e proporção, combinada com a afordância.
 */
const MOLDURA = "relative w-full min-w-0 overflow-hidden rounded-xl aspect-[16/9] bg-muted";

describe("AFORDANCIA_DE_BANNER", () => {
  /**
   * A regressão que este arquivo existe para impedir.
   *
   * `cn` usa `tailwind-merge`: classes do mesmo grupo se anulam e vence a
   * última. Quando a constante trazia `rounded-[inherit]`, ela apagava o
   * `rounded-xl` da moldura e as peças **com link** ficavam de canto vivo — as
   * sem link não, porque não recebem estas classes. Foi assim que o defeito
   * passou: metade dos banners continuava certa.
   */
  it("não apaga o raio que a moldura definiu", () => {
    const resultado = cn(MOLDURA, AFORDANCIA_DE_BANNER);
    expect(resultado).toContain("rounded-xl");
  });

  it("não traz classe de raio nenhuma", () => {
    // Mais direto que o teste acima: o problema é a categoria inteira, não um
    // valor específico. `rounded-none` ou `rounded-full` fariam o mesmo estrago.
    expect(AFORDANCIA_DE_BANNER).not.toMatch(/(^|\s)(motion-safe:|hover:|active:|focus-visible:)*rounded-/);
  });

  it("preserva a proporção da moldura", () => {
    // A proporção é o que impede a arte de ser cortada. Uma classe de aspecto
    // aqui teria o mesmo efeito do raio: sobrescreveria a de cada área.
    expect(cn(MOLDURA, AFORDANCIA_DE_BANNER)).toContain("aspect-[16/9]");
  });

  it("o afundar do clique vem depois do levantar do hover", () => {
    // No desktop os dois estados valem ao mesmo tempo enquanto o botão está
    // pressionado, e ambos mexem em `translate-y`. Como têm a mesma
    // especificidade, quem vence é quem o Tailwind emitir por último — e a
    // ordem de emissão segue a ordem das variantes, não a do texto. Este teste
    // guarda a intenção: se alguém remover o `active`, o clique deixa de ter
    // resposta e ninguém percebe.
    expect(AFORDANCIA_DE_BANNER).toContain("motion-safe:active:translate-y-[1px]");
    expect(AFORDANCIA_DE_BANNER).toContain("motion-safe:hover:-translate-y-1");
  });

  it("todo movimento fica atrás de motion-safe", () => {
    // Quem pediu menos animação no sistema continua tendo sombra e anel de
    // foco; o aviso de que a peça é clicável não pode depender de movimento.
    for (const classe of AFORDANCIA_DE_BANNER.split(/\s+/)) {
      if (/(translate|scale)/.test(classe) && !classe.includes("[&_img]")) {
        expect(classe, classe).toMatch(/^motion-safe:/);
      }
    }
  });
});
