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

import { parseOrderTableLines } from "@/lib/orders";
import {
  type ColunaCsv,
  dataParaCelula,
  gerarCsv,
  simOuNao,
} from "@/lib/csvDoTitular";

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
  mensagens: unknown[];
  aparelhos: unknown[];
};

/** As seções do pacote, na ordem em que a tela as lista. */
export const CHAVES_DO_PACOTE = [
  "perfil",
  "enderecos",
  "pedidos",
  "avaliacoes",
  "favoritos",
  "conversas",
  "mensagens",
  "aparelhos",
] as const;

export type ChaveDeSecao = (typeof CHAVES_DO_PACOTE)[number];

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
  mensagens: "O texto do que foi escrito no atendimento, seu e nosso.",
  aparelhos: "Lembrar dispositivos confiáveis para não pedir o segundo fator toda vez.",
} as const;

const TITULOS = {
  perfil: "Cadastro",
  enderecos: "Endereços de entrega",
  pedidos: "Pedidos",
  avaliacoes: "Avaliações que você escreveu",
  favoritos: "Lista de favoritos",
  conversas: "Conversas de suporte",
  mensagens: "Mensagens do atendimento",
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
      mensagens: secao("mensagens", partes.mensagens),
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

/** `clinic-mais-enderecos-2026-09-01.csv` — o mesmo critério, uma seção só. */
export function nomeDoArquivoDaSecao(chave: ChaveDeSecao, agora: Date = new Date()): string {
  const dia = agora.toISOString().slice(0, 10);
  return `clinic-mais-${chave}-${dia}.csv`;
}

const texto = (valor: unknown): string => (typeof valor === "string" ? valor : valor == null ? "" : String(valor));

/** Junta as partes de um endereço numa linha só, pulando o que estiver vazio. */
function enderecoEmUmaLinha(registro: Record<string, unknown>, prefixo: string): string {
  const rua = [texto(registro[`${prefixo}street`]), texto(registro[`${prefixo}number`])].filter(Boolean).join(", ");
  const local = [texto(registro[`${prefixo}neighborhood`]), texto(registro[`${prefixo}city`])].filter(Boolean).join(" - ");
  const uf = texto(registro[`${prefixo}state`]);
  const cep = texto(registro[`${prefixo}cep`]);
  return [rua, local, uf, cep && `CEP ${cep}`].filter(Boolean).join(", ");
}

/**
 * As colunas de cada planilha.
 *
 * ## Por que a lista é escrita à mão
 *
 * O JSON sai de `select("*")`, então carrega o nome de coluna do banco e os
 * campos de controle — `submission_key`, `proxis_attempts`, `representante_id`.
 * Num arquivo para máquina isso não atrapalha; numa planilha para uma pessoa,
 * são vinte colunas de ruído antes da que ela procura.
 *
 * O preço é a completude: **o CSV mostra menos que o JSON**. É por isso que a
 * tela diz qual é qual, e que "baixar tudo" continua sendo o JSON.
 */
export const COLUNAS_DA_SECAO: Record<ChaveDeSecao, ColunaCsv[]> = {
  perfil: [
    { rotulo: "Nome", valor: (r) => texto(r.name) },
    { rotulo: "E-mail", valor: (r) => texto(r.email) },
    { rotulo: "Telefone", valor: (r) => texto(r.phone) },
    { rotulo: "Empresa", valor: (r) => texto(r.company) },
    { rotulo: "CNPJ", valor: (r) => texto(r.cnpj) },
    { rotulo: "CNPJ vinculado", valor: (r) => texto(r.linked_company_cnpj) },
    { rotulo: "Tipo de cliente", valor: (r) => texto(r.customer_type) },
    { rotulo: "MEI", valor: (r) => simOuNao(r.is_mei) },
    { rotulo: "Aceita campanhas", valor: (r) => simOuNao(r.aceita_campanhas) },
    { rotulo: "Endereço do cadastro", valor: (r) => enderecoEmUmaLinha(r, "address_") },
    { rotulo: "Cadastro criado em", valor: (r) => dataParaCelula(r.created_at) },
    { rotulo: "Última atualização", valor: (r) => dataParaCelula(r.updated_at) },
  ],
  enderecos: [
    { rotulo: "Apelido", valor: (r) => texto(r.label) },
    { rotulo: "CEP", valor: (r) => texto(r.cep) },
    { rotulo: "Rua", valor: (r) => texto(r.street) },
    { rotulo: "Número", valor: (r) => texto(r.number) },
    { rotulo: "Complemento", valor: (r) => texto(r.complement) },
    { rotulo: "Bairro", valor: (r) => texto(r.neighborhood) },
    { rotulo: "Cidade", valor: (r) => texto(r.city) },
    { rotulo: "Estado", valor: (r) => texto(r.state) },
    { rotulo: "Endereço padrão", valor: (r) => simOuNao(r.is_default) },
    { rotulo: "Criado em", valor: (r) => dataParaCelula(r.created_at) },
  ],
  // ⚠️ Uma linha por **item**, e não por pedido.
  //
  // Uma linha por pedido teria de espremer os itens numa célula ou omiti-los, e
  // é justamente o item que a pessoa vai querer somar na planilha. Os campos do
  // pedido se repetem em cada linha — é o formato de qualquer exportação de
  // vendas, e o que uma tabela dinâmica espera.
  pedidos: [
    { rotulo: "Pedido", valor: (r) => texto(r.pedido_id) },
    { rotulo: "Data", valor: (r) => dataParaCelula(r.data) },
    { rotulo: "Situação", valor: (r) => texto(r.situacao) },
    { rotulo: "Produto", valor: (r) => texto(r.produto) },
    { rotulo: "Código", valor: (r) => texto(r.codigo) },
    { rotulo: "Quantidade", valor: (r) => Number(r.quantidade) || 0 },
    { rotulo: "Preço unitário", valor: (r) => Number(r.preco_unitario) || 0 },
    { rotulo: "Total do item", valor: (r) => Number(r.total_do_item) || 0 },
    { rotulo: "Entrega", valor: (r) => texto(r.entrega) },
  ],
  avaliacoes: [
    { rotulo: "Produto", valor: (r) => texto(r.product_id) },
    { rotulo: "Nota", valor: (r) => Number(r.rating) || 0 },
    { rotulo: "Título", valor: (r) => texto(r.title) },
    { rotulo: "Comentário", valor: (r) => texto(r.comment) },
    { rotulo: "Marcadores", valor: (r) => (Array.isArray(r.tags) ? r.tags.join(", ") : "") },
    { rotulo: "Resposta da loja", valor: (r) => texto(r.admin_response) },
    { rotulo: "Respondida em", valor: (r) => dataParaCelula(r.admin_responded_at) },
    { rotulo: "Escrita em", valor: (r) => dataParaCelula(r.created_at) },
  ],
  favoritos: [
    { rotulo: "Produto", valor: (r) => texto(r.nome_do_produto) || texto(r.product_id) },
    { rotulo: "Código", valor: (r) => texto(r.codigo_do_produto) },
    { rotulo: "Quantidade separada", valor: (r) => Number(r.quantity) || 0 },
    { rotulo: "Adicionado em", valor: (r) => dataParaCelula(r.created_at) },
  ],
  conversas: [
    { rotulo: "Assunto", valor: (r) => texto(r.subject) },
    { rotulo: "Situação", valor: (r) => texto(r.status) },
    { rotulo: "Última mensagem", valor: (r) => texto(r.last_message_preview) },
    { rotulo: "Última mensagem em", valor: (r) => dataParaCelula(r.last_message_at) },
    { rotulo: "Aberta em", valor: (r) => dataParaCelula(r.created_at) },
    { rotulo: "Finalizada em", valor: (r) => dataParaCelula(r.finalizada_em) },
  ],
  mensagens: [
    { rotulo: "Data", valor: (r) => dataParaCelula(r.created_at) },
    { rotulo: "Quem escreveu", valor: (r) => (texto(r.sender_role) === "customer" ? "Você" : "Atendimento") },
    { rotulo: "Mensagem", valor: (r) => texto(r.body) },
    { rotulo: "Conversa", valor: (r) => texto(r.conversation_id) },
  ],
  aparelhos: [
    { rotulo: "Aparelho", valor: (r) => texto(r.rotulo) },
    { rotulo: "Lembrado em", valor: (r) => dataParaCelula(r.criado_em) },
    { rotulo: "Último uso", valor: (r) => dataParaCelula(r.ultimo_uso_em) },
    { rotulo: "Expira em", valor: (r) => dataParaCelula(r.expira_em) },
    { rotulo: "Revogado em", valor: (r) => dataParaCelula(r.revogado_em) },
  ],
};

/**
 * As linhas da planilha de uma seção.
 *
 * Só `pedidos` muda de forma: as demais já são uma linha por registro.
 */
export function linhasDaSecao(chave: ChaveDeSecao, registros: unknown[]): Record<string, unknown>[] {
  if (chave !== "pedidos") return registros as Record<string, unknown>[];

  return (registros as Record<string, unknown>[]).flatMap((pedido) => {
    const entrega = enderecoEmUmaLinha(pedido, "customer_address_");
    const comum = {
      pedido_id: pedido.id,
      data: pedido.created_at,
      situacao: pedido.status,
      entrega,
    };

    const itens = parseOrderTableLines(pedido.items);
    // Pedido sem item ainda vira uma linha: sumir com ele faria a contagem da
    // tela discordar do arquivo, e a pessoa não saberia qual das duas mente.
    if (itens.length === 0) {
      return [{ ...comum, produto: "", codigo: "", quantidade: 0, preco_unitario: 0, total_do_item: 0 }];
    }

    return itens.map((item) => ({
      ...comum,
      produto: item.name,
      codigo: item.code,
      quantidade: item.quantity,
      preco_unitario: item.unitPrice,
      total_do_item: item.subtotal,
    }));
  });
}

/** A planilha pronta de uma seção do pacote. */
export function csvDaSecao(pacote: PacoteDeDados, chave: ChaveDeSecao): string {
  return gerarCsv(COLUNAS_DA_SECAO[chave], linhasDaSecao(chave, pacote.secoes[chave]?.registros ?? []));
}

/** O conteúdo pronto para virar arquivo, indentado para ser legível por gente. */
export function serializarPacote(pacote: PacoteDeDados): string {
  return `${JSON.stringify(pacote, null, 2)}\n`;
}
