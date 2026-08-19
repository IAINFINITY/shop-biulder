/**
 * Exclusão de conta — o que sai, o que fica, e por quê.
 *
 * A §27 do padrão de autenticação exige que a interface **explique** o que é
 * excluído, retido, anonimizado ou transferido, e proíbe apresentar soft delete
 * como apagamento. A LGPD dá ao titular o direito de eliminação (art. 18, VI),
 * mas o mesmo artigo ressalva a guarda exigida por obrigação legal.
 *
 * Este arquivo é a lista honesta dessas duas coisas, num lugar só — a tela mostra
 * exatamente o que a rota faz, porque as duas leem daqui.
 *
 * ## A decisão que importa
 *
 * Este é um sistema B2B: **o pedido pertence ao CNPJ da empresa, não à conta
 * pessoal**. `orders` confirma — é chaveada por `customer_cnpj`, sem `user_id`.
 *
 * Some-se a isso a guarda fiscal: nota emitida tem prazo legal de retenção. Então
 * apagar a conta **não** apaga o histórico de compras, e dizer o contrário seria
 * exatamente o que a §27 proíbe.
 *
 * ## A conversa de suporte NÃO segue essa regra
 *
 * Este arquivo afirmava que ela também ficava, vinculada ao CNPJ. Era falso, e a
 * tabela sempre disse o contrário: `support_conversations.customer_user_id` e
 * `support_messages.sender_user_id` têm `on delete cascade` para `auth.users`
 * (migrations `20260701150000` e `20260806160000`). Apagar a conta leva a
 * conversa inteira junto.
 *
 * Confirmado em produção em 19/08/2026: uma conta de teste que abriu a seção de
 * mensagens criou a conversa, e ela desapareceu com a exclusão da conta.
 *
 * O texto foi corrigido para descrever o que acontece. A alternativa seria mudar
 * o banco para reter a conversa anonimizada — decisão de negócio, ainda em
 * aberto; enquanto não for tomada, a tela diz a verdade.
 */

export type ItemDeDados = {
  titulo: string;
  detalhe: string;
};

/** Apagado de verdade, sem cópia recuperável. */
export const DADOS_EXCLUIDOS: ItemDeDados[] = [
  {
    titulo: "Seu acesso",
    detalhe: "E-mail, senha e qualquer verificação em duas etapas. Você não conseguirá mais entrar.",
  },
  {
    titulo: "Seu cadastro",
    detalhe: "Nome, telefone, CNPJ vinculado à sua conta e endereços de entrega salvos.",
  },
  {
    titulo: "Sua lista de favoritos",
    detalhe: "Os produtos que você salvou para comprar depois.",
  },
  {
    titulo: "Suas avaliações",
    detalhe: "As notas e comentários que você escreveu sobre produtos saem do site.",
  },
  {
    titulo: "Suas conversas de suporte",
    detalhe:
      "O histórico de atendimento aberto pela sua conta é apagado junto, incluindo as mensagens trocadas. Se precisar guardar alguma informação combinada por ali, salve antes de excluir.",
  },
];

/** Continua existindo — e a tela precisa dizer por quê. */
export const DADOS_RETIDOS: ItemDeDados[] = [
  {
    titulo: "Seus pedidos",
    detalhe:
      "Pedido é documento fiscal e pertence ao CNPJ da empresa, não à conta pessoal. A legislação exige guarda por prazo determinado, então o histórico permanece — sem ligação com a sua conta.",
  },
  {
    titulo: "Registro de segurança",
    detalhe:
      "A trilha de acessos guarda apenas datas e identificadores internos — nenhum dado pessoal. Ela existe para investigar incidentes e não é apagada.",
  },
];

/** O que a pessoa digita para confirmar. */
export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

/**
 * A confirmação está correta?
 *
 * Comparação em maiúsculas e sem espaço nas pontas: quem digitou certo com o
 * teclado em minúsculo acertou de fato, e recusar aí seria obstáculo sem
 * propósito. O que a palavra existe para evitar é o clique automático, não erro
 * de digitação.
 */
export function confirmacaoValida(texto: string): boolean {
  return texto.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}

export type MotivoDeBloqueio = string | null;

/**
 * Pode seguir com a exclusão?
 *
 * A §27 exige "reautenticação forte recente" — daí a senha ser obrigatória mesmo
 * com a pessoa já logada. Sessão esquecida aberta num computador compartilhado
 * não pode virar conta apagada.
 */
export function motivoParaNaoExcluir(confirmacao: string, senha: string): MotivoDeBloqueio {
  if (!confirmacaoValida(confirmacao)) {
    return `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`;
  }
  if (!senha) {
    return "Informe sua senha atual para confirmar que é você.";
  }
  return null;
}
