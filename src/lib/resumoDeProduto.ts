/**
 * O resumo do produto escrito por IA — a regra, pura e testavel.
 *
 * O card "Resumo" da pagina do produto mostra as primeiras frases da descricao,
 * recortadas por `summarizeDescription`. Funciona quando a descricao ja e curta;
 * nos 40 produtos com mais de 3 mil caracteres o recorte pega o comeco do texto
 * de marketing e nao o que a pessoa precisa saber.
 *
 * Aqui esta o que decide o conteudo: o prompt, a leitura da resposta e — a parte
 * que importa de verdade — a **recusa** do resumo que faca alegacao proibida.
 *
 * ## Por que a validacao existe
 *
 * Clinic+ vende suplemento alimentar. Pela regra da ANVISA, suplemento nao pode
 * alegar curar, tratar ou prevenir doenca: isso e alegacao terapeutica, que so
 * medicamento pode fazer. Um resumo automatico comprime texto, e comprimir
 * "auxilia no funcionamento muscular" com folga vira "trata dores musculares".
 * O modelo nao sabe que a diferenca entre as duas frases e uma infracao.
 *
 * A lista abaixo e **piso, nao teto**. Ela pega a alegacao obvia; nao pega
 * insinuacao. Por isso o resumo entra no formulario como rascunho e alguem le
 * antes de publicar — a validacao existe para o erro grosseiro nao chegar la.
 *
 * ## O outro risco: a omissao
 *
 * Resumir e escolher o que fica de fora, e o modelo escolhia o atributo
 * simpatico. No 3 Omegas ele manteve "nao contem gluten" e descartou "contem
 * oleo de peixe", "nao e vegano" e "maiores de 19 anos" — as tres restricoes da
 * descricao. Para quem tem alergia a peixe, o resumo ficou pior que resumo
 * nenhum: sugere que a parte de restricao ja foi coberta.
 *
 * Nao era descuido do modelo, era regra que faltava. Daí a linha do prompt que
 * poe restricao acima de atributo positivo — a validacao nao alcanca isso, ela
 * so ve o que **esta** escrito, nunca o que deixou de estar.
 */

/**
 * O tamanho do resumo, apertado de proposito.
 *
 * Era de 2 a 5, e a variacao aparecia: o mesmo card ficava com duas linhas num
 * produto e cinco no seguinte. Resumo e formato, e formato que muda a cada
 * produto e ruido.
 *
 * **Quatro e o alvo.** Sai da propria estrutura das descricoes do catalogo, que
 * repetem o mesmo arranjo: o que e (composicao), para que serve, restricao, como
 * usar. Quatro itens cobrem os quatro sem sobrar.
 *
 * O piso de tres existe porque 64 produtos tem descricao com menos de 400
 * caracteres. Exigir quatro deles seria empurrar o modelo a inventar o quarto —
 * e inventar e o pior defeito possivel aqui, pior que um card curto.
 */
export const MAX_ITENS = 4;
export const MIN_ITENS = 3;
/** Um item precisa caber em duas linhas do card. */
export const MAX_CARACTERES_POR_ITEM = 140;

/**
 * Alegacao que transforma suplemento em medicamento aos olhos da ANVISA.
 *
 * Guardadas sem acento porque a comparacao normaliza os dois lados: assim
 * "prevencao" e "prevenção" caem na mesma entrada, e a lista nao precisa
 * duplicar cada palavra.
 */
export const TERMOS_PROIBIDOS = [
  "cura",
  "curar",
  "cure",
  "trata",
  "tratar",
  "tratamento",
  "previne",
  "prevenir",
  "prevencao",
  "combate a doenca",
  "remedio",
  "medicamento",
  "terapeutico",
  "terapeutica",
  "diagnostica",
  "diagnostico",
  "emagrece",
  "emagrecer",
  "emagrecimento",
  "queima gordura",
  "elimina gordura",
  "substitui refeicao",
  "efeito imediato",
  "resultado garantido",
  "sem efeitos colaterais",
] as const;

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type ProdutoParaResumo = {
  name: string;
  description: string;
  type?: string | null;
  brand?: string | null;
};

export type PromptDeResumo = {
  sistema: string;
  usuario: string;
};

/**
 * As duas mensagens enviadas ao modelo.
 *
 * Vive aqui, e nao dentro da rota, porque prompt e regra de negocio: e o texto
 * que decide se o resumo sai legal ou ilegal. Na rota ele so seria conferido
 * chamando a API de verdade.
 */
export function construirPromptDeResumo(produto: ProdutoParaResumo): PromptDeResumo {
  const sistema = [
    "Você resume produtos de um catálogo brasileiro de suplementos alimentares e cosméticos.",
    "",
    "Regras obrigatórias:",
    "- Escreva em português do Brasil.",
    `- Devolva ${MAX_ITENS} itens, um por linha, sem numeração e sem marcador.`,
    `- ${MAX_ITENS} é o alvo. Use ${MIN_ITENS} apenas se a descrição não sustentar o quarto item sem repetir ou inventar — nunca complete o número com conteúdo que não está na descrição.`,
    `- Cada item tem no máximo ${MAX_CARACTERES_POR_ITEM} caracteres e é uma frase completa.`,
    "- Use apenas informação presente na descrição. Não invente ingrediente, dosagem, certificação nem indicação.",
    "- É PROIBIDO afirmar que o produto cura, trata, previne ou diagnostica qualquer doença.",
    "- É PROIBIDO prometer emagrecimento, resultado garantido, efeito imediato ou ausência de efeitos colaterais.",
    "- Prefira o verbo que a própria descrição usa: 'auxilia', 'contribui para', 'contém'.",
    "- Se a descrição citar alérgeno, restrição de idade, contraindicação ou origem animal, um dos itens PRECISA trazer isso. Restrição vence atributo positivo: entre 'não contém glúten' e 'contém peixe', o segundo é obrigatório.",
    "- Não repita o nome do produto: quem lê já está na página dele.",
    "- Sem texto de abertura, sem conclusão, sem markdown. Apenas as linhas.",
  ].join("\n");

  const contexto = [
    `Produto: ${produto.name}`,
    produto.brand ? `Marca: ${produto.brand}` : null,
    produto.type ? `Categoria: ${produto.type}` : null,
    "",
    "Descrição:",
    produto.description,
  ]
    .filter((linha) => linha !== null)
    .join("\n");

  return { sistema, usuario: contexto };
}

/**
 * A resposta do modelo vira lista de itens.
 *
 * Tolerante de proposito: o modelo as vezes numera, as vezes usa hifen, as vezes
 * abre com "Aqui esta o resumo:". Nada disso e motivo para descartar a resposta
 * inteira — e o tipo de coisa que muda sozinha entre versoes do modelo.
 */
export function normalizarResumo(bruto: string): string[] {
  return bruto
    .split(/\r?\n/)
    .map((linha) =>
      linha
        .trim()
        // marcador, numeracao e aspas de borda
        .replace(/^[-*•–—]+\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^["'“”]|["'“”]$/g, "")
        .trim(),
    )
    .filter((linha) => linha.length > 0)
    // Linha de abertura do tipo "Resumo:" nao e item.
    .filter((linha) => !/^(resumo|aqui esta|segue)\b.{0,20}:$/i.test(linha))
    .slice(0, MAX_ITENS);
}

/**
 * `motivo` existe nos dois lados de proposito.
 *
 * A forma natural seria `{ ok: true } | { ok: false; motivo: string }`, mas o
 * projeto compila com `strict: false` — sem `strictNullChecks` o TypeScript nao
 * discrimina uniao por literal booleano, e ler `motivo` depois de um `if
 * (!resultado.ok)` vira erro de compilacao. Com a propriedade presente nos dois
 * membros, o acesso e sempre valido e o `null` diz "aprovado".
 */
export type ResultadoDaValidacao = { ok: true; motivo: null } | { ok: false; motivo: string };

/**
 * O resumo pode ser publicado?
 *
 * Recusar e o comportamento certo no caso duvidoso: gerar de novo custa cerca de
 * um centavo, e publicar alegacao terapeutica custa multa.
 */
export function validarResumo(itens: readonly string[]): ResultadoDaValidacao {
  if (itens.length < MIN_ITENS) {
    return { ok: false, motivo: `O resumo precisa de pelo menos ${MIN_ITENS} itens.` };
  }
  if (itens.length > MAX_ITENS) {
    return { ok: false, motivo: `O resumo passou de ${MAX_ITENS} itens.` };
  }

  const longo = itens.find((item) => item.length > MAX_CARACTERES_POR_ITEM);
  if (longo) {
    return {
      ok: false,
      motivo: `Um item passou de ${MAX_CARACTERES_POR_ITEM} caracteres: "${longo.slice(0, 40)}…".`,
    };
  }

  for (const item of itens) {
    const normalizado = semAcento(item);
    const proibido = TERMOS_PROIBIDOS.find((termo) =>
      // `\b` nos dois lados para "cura" nao casar dentro de "curativo" nem
      // "trata" dentro de "contratado".
      new RegExp(`\\b${termo.replace(/ /g, "\\s+")}\\b`).test(normalizado),
    );
    if (proibido) {
      return {
        ok: false,
        motivo: `O resumo usou "${proibido}", que é alegação proibida para suplemento. Gere de novo.`,
      };
    }
  }

  return { ok: true, motivo: null };
}

/** Como o resumo fica guardado no banco: um item por linha. */
export function resumoParaTexto(itens: readonly string[]): string {
  return itens.join("\n");
}

/** E como ele volta do banco. */
export function textoParaResumo(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
}
