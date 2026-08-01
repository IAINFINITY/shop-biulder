/**
 * Tipografia da descricao do produto — definicao unica.
 *
 * O editor do admin e a vitrine exibem exatamente o mesmo HTML, entao precisam
 * das mesmas regras. Enquanto cada lado tinha as suas, o editor herdava os
 * padroes do plugin de tipografia (titulo em peso 700, tamanho relativo 1.5em,
 * cor cheia) e a vitrine aplicava os seus proprios (semibold, 1.05rem, corpo a
 * 85%). Quem escrevia via um texto mais forte do que o que ia para o ar, e a
 * formatacao era decidida sobre uma amostra que nao correspondia ao resultado.
 *
 * Por isso a lista mora aqui e nao em nenhum dos dois: mudanca feita de um lado
 * so volta a separar os dois. Se for preciso ajustar, ajuste aqui.
 *
 * Fica fora de arquivo de componente de proposito — arquivo que exporta
 * componente e constante junto quebra o Fast Refresh e duplica o modulo.
 */
export const PRODUCT_DESCRIPTION_PROSE = [
  "prose max-w-none",

  // Base do corpo. Declarada aqui em vez de vir por `prose-sm`/`prose-base`
  // para que os dois lados partam do mesmo tamanho.
  "text-sm leading-7 text-foreground/90 sm:text-base",

  // Titulo se destaca do corpo sem competir com o nome do produto na pagina.
  "prose-headings:font-semibold prose-headings:text-foreground",
  "prose-h2:mb-2 prose-h2:mt-6 prose-h2:text-lg prose-h2:tracking-[0.01em]",
  "prose-h3:mb-1.5 prose-h3:mt-5 prose-h3:text-base",
  "prose-h2:first:mt-0 prose-h3:first:mt-0",

  // Paragrafo sem margem nenhuma, por decisao de quem escreve: o Enter avanca
  // exatamente uma linha, como em qualquer editor de texto. O plugin `prose`
  // poe margem em cima E embaixo, entao as duas precisam ser zeradas — zerar so
  // uma deixava a outra em 1.25em e o intervalo continuava aparecendo.
  //
  // A separacao entre assuntos passa a vir dos titulos (h2/h3, que mantem a
  // folga acima). Quebra de linha e paragrafo ficam iguais na tela; a diferenca
  // continua existindo no HTML, e e o que a leitura por voz e os buscadores
  // usam para saber onde um paragrafo termina.
  "prose-p:mt-0 prose-p:mb-0 prose-p:leading-7 prose-p:text-foreground/85",

  // Paragrafo vazio vale uma linha em branco.
  //
  // Sem margem, um <p></p> nao tem conteudo nem altura: some da pagina. Quem
  // apertava Enter duas vezes para abrir espaco nao via diferenca nenhuma e
  // achava que o texto nao tinha salvo. Com uma altura de linha, o controle
  // volta para quem escreve: Enter desce uma linha, Enter duas vezes abre uma
  // linha em branco de verdade — como em qualquer editor de texto.
  //
  // No editor isso ja acontece sozinho: o TipTap poe um <br> dentro do
  // paragrafo vazio, entao ele nao casa com `:empty` e ganha altura pelo <br>.
  // A regra existe para o HTML salvo, que vem sem esse <br>.
  "[&_p:empty]:min-h-7",

  // `list-disc`/`list-decimal` explicitos: o reset do Tailwind zera o marcador,
  // e sem isso a lista numerada perde a numeracao.
  "prose-ul:my-3 prose-ul:list-disc prose-ul:pl-5",
  "prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-5",
  "prose-li:my-0.5 prose-li:leading-7 prose-li:text-foreground/85 prose-li:marker:text-primary",

  "prose-strong:font-semibold prose-strong:text-foreground",
  "prose-em:italic",
  "prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline",
  "prose-blockquote:border-l-4 prose-blockquote:border-primary/25 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic",
  "prose-hr:my-6 prose-hr:border-border/70",

  // O editor marca sublinhado e riscado com as tags cruas.
  "[&_u]:underline [&_s]:line-through",
].join(" ");
