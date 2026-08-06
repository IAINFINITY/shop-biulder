/**
 * Para onde um banner aponta, e se isso e navegacao interna.
 *
 * O admin costuma colar o endereco inteiro da barra do navegador —
 * `http://127.0.0.1:8080/?categoria=Whey` — e nao o caminho. Tratar isso como
 * link externo faria duas coisas erradas: abriria aba nova para uma pagina do
 * proprio site e, pior, apontaria para a **maquina de quem cadastrou** depois do
 * deploy.
 *
 * Aqui o host e comparado com o da pagina: mesmo host vira caminho relativo e
 * navega por dentro do app, preservando o estado. Host diferente continua
 * externo.
 */
export type DestinoDeBanner =
  | { tipo: "interno"; para: string }
  | { tipo: "externo"; para: string }
  | null;

export function resolverLinkDeBanner(valor: string | null | undefined): DestinoDeBanner {
  const bruto = (valor ?? "").trim();
  if (!bruto) return null;

  // Caminho relativo ja e interno.
  if (bruto.startsWith("/")) return { tipo: "interno", para: bruto };

  // Ancora e caminho sem barra: normaliza para nao virar link quebrado.
  if (bruto.startsWith("#") || bruto.startsWith("?")) return { tipo: "interno", para: `/${bruto}` };

  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    // Nao e URL valida nem caminho: melhor nao virar link do que virar um quebrado.
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (typeof window !== "undefined" && url.host === window.location.host) {
    return { tipo: "interno", para: `${url.pathname}${url.search}${url.hash}` };
  }

  return { tipo: "externo", para: url.toString() };
}
