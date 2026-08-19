/**
 * O pacote de dados do titular — art. 18, II e V da LGPD.
 *
 * ## Dois direitos, um arquivo
 *
 * O art. 18, II dá direito ao **acesso**: saber o que se guarda sobre a pessoa.
 * O art. 18, V dá direito à **portabilidade**: levar isso embora num formato
 * que outro sistema consiga ler. Um JSON estruturado atende os dois — a tela
 * mostra o conteúdo, o botão entrega o arquivo.
 *
 * O art. 19, II ainda exige que a declaração seja "clara e completa", indicando
 * a origem dos dados, os critérios e a finalidade. Por isso cada seção do pacote
 * carrega a própria explicação: um despejo de tabelas seria completo e não seria
 * claro.
 *
 * ## Por que a montagem mora aqui, e a busca não
 *
 * Convenção do projeto: lógica pura em `src/lib`, I/O em quem chama. Assim o
 * formato do pacote pode ser testado sem servidor e sem sessão — e é o formato
 * que importa, porque é ele que sai para fora da empresa.
 */

/** Uma seção do pacote: o que é, por que existe, e as linhas. */
export type SecaoDeDados = {
  titulo: string;
  finalidade: string;
  registros: unknown[];
};

export type PacoteDeDados = {
  gerado_em: string;
  titular: { id: string; email: string | null };
  aviso: string;
  secoes: Record<string, SecaoDeDados>;
};

export type PartesDoPacote = {
  perfil: unknown | null;
  enderecos: unknown[];
  pedidos: unknown[];
  avaliacoes: unknown[];
  favoritos: unknown[];
  conversas: unknown[];
  aparelhos: unknown[];
};

/**
 * A finalidade de cada seção, na linguagem de quem lê — não na do banco.
 *
 * Sai do registro do art. 37, e é o que transforma um despejo em declaração:
 * quem abre o arquivo entende para que serve cada bloco sem consultar ninguém.
 */
const FINALIDADES = {
  perfil: "Identificar você e a empresa, e permitir o acesso à conta.",
  enderecos: "Endereçar a entrega dos pedidos.",
  pedidos: "Processar e faturar as compras. Guardados por 5 anos, por exigência fiscal.",
  avaliacoes: "Publicar sua experiência com os produtos para outros compradores.",
  favoritos: "Guardar os produtos que você separou para depois.",
  conversas: "Atender dúvidas e reclamações. Guardadas por 2 anos após a última mensagem.",
  aparelhos: "Lembrar dispositivos confiáveis para não pedir o segundo fator toda vez.",
} as const;

const TITULOS = {
  perfil: "Cadastro",
  enderecos: "Endereços de entrega",
  pedidos: "Pedidos",
  avaliacoes: "Avaliações que você escreveu",
  favoritos: "Lista de favoritos",
  conversas: "Conversas de suporte",
  aparelhos: "Aparelhos lembrados",
} as const;

const AVISO =
  "Este arquivo reúne os dados pessoais que a Clinic+ guarda sobre você no catálogo B2B, " +
  "conforme o art. 18, II e V da Lei 13.709/2018. Ele não inclui dados que estejam apenas " +
  "no ERP Proxsys, sistema em que o pedido vira documento fiscal.";

/** Monta o pacote a partir das partes já buscadas. */
export function montarPacoteDeDados(
  titular: { id: string; email: string | null },
  partes: PartesDoPacote,
  agora: Date = new Date(),
): PacoteDeDados {
  const secao = (chave: keyof typeof TITULOS, registros: unknown[]): SecaoDeDados => ({
    titulo: TITULOS[chave],
    finalidade: FINALIDADES[chave],
    registros,
  });

  return {
    gerado_em: agora.toISOString(),
    titular,
    aviso: AVISO,
    secoes: {
      // O perfil é uma linha só; vira lista para o formato ficar uniforme.
      perfil: secao("perfil", partes.perfil ? [partes.perfil] : []),
      enderecos: secao("enderecos", partes.enderecos),
      pedidos: secao("pedidos", partes.pedidos),
      avaliacoes: secao("avaliacoes", partes.avaliacoes),
      favoritos: secao("favoritos", partes.favoritos),
      conversas: secao("conversas", partes.conversas),
      aparelhos: secao("aparelhos", partes.aparelhos),
    },
  };
}

/** Quantos registros o pacote tem em cada seção — é o que a tela resume. */
export function contarRegistros(pacote: PacoteDeDados): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const [chave, secao] of Object.entries(pacote.secoes)) {
    contagem[chave] = secao.registros.length;
  }
  return contagem;
}

/**
 * Nome do arquivo: `clinic-mais-meus-dados-2026-08-19.json`.
 *
 * Data no nome porque a pessoa pode exportar mais de uma vez, e dois arquivos
 * com o mesmo nome viram um só na pasta de downloads.
 */
export function nomeDoArquivo(agora: Date = new Date()): string {
  const dia = agora.toISOString().slice(0, 10);
  return `clinic-mais-meus-dados-${dia}.json`;
}

/** O conteúdo pronto para virar arquivo, indentado para ser legível por gente. */
export function serializarPacote(pacote: PacoteDeDados): string {
  return `${JSON.stringify(pacote, null, 2)}\n`;
}
