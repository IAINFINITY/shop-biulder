/**
 * Cadastros parados na confirmação de e-mail.
 *
 * ## Por que o painel precisa disto
 *
 * O perfil do cliente só nasce **depois** que a pessoa confirma o e-mail — é um
 * gatilho no banco. Antes disso a conta existe em `auth.users`, mas não existe
 * em `clinic+b2b_customer_profiles`, e a aba Clientes lê dos perfis.
 *
 * O efeito prático: quem trava na confirmação fica **invisível para o
 * atendimento**. Foi assim que a Opção de Vida chegou ao suporte — duas contas
 * criadas no mesmo dia, nenhuma confirmada, e a resposta do painel era que o
 * cadastro não existia. Existia, e os dados estavam guardados.
 *
 * ## O que é seguro mostrar
 *
 * Só o que já foi digitado no próprio cadastro: e-mail, empresa, CNPJ e quando
 * a conta foi criada. Nada de token, hash de senha ou link de confirmação — o
 * link é credencial de acesso, e exibi-lo no painel transformaria a lista num
 * caminho para entrar na conta de terceiros.
 */

/** O que vem de `auth.users`, no recorte que interessa. */
export type UsuarioBruto = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  /** Quando o e-mail de confirmacao saiu daqui pela ultima vez. */
  confirmation_sent_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
};

export type CadastroPendente = {
  id: string;
  email: string;
  criadoEm: string;
  empresa: string;
  cnpj: string;
  /** Quantos dias a conta está parada. Ajuda a priorizar quem ligar primeiro. */
  diasParado: number;
  /**
   * Quando o e-mail saiu, ou vazio se nunca saiu.
   *
   * Separa dois problemas que pedem respostas opostas: **não enviamos** (algo
   * quebrado do nosso lado) e **enviamos e não chegou** (spam, caixa cheia,
   * endereço errado). Sem isso o atendimento chuta.
   */
  enviadoEm: string;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * A conta está travada na confirmação?
 *
 * Exige **as duas** condições: sem confirmação e sem nenhum login. Só a
 * primeira não bastaria — uma conta criada pelo painel entra já confirmada, e
 * conta antiga de antes da regra atual pode ter `email_confirmed_at` nulo sem
 * estar travada de verdade, porque já entrou alguma vez.
 */
export function estaPendenteDeConfirmacao(usuario: UsuarioBruto | null | undefined): boolean {
  if (!usuario) return false;
  return !usuario.email_confirmed_at && !usuario.last_sign_in_at;
}

/** Dias inteiros entre a criação e agora. `agora` entra por parâmetro para o teste fixar. */
function diasDesde(iso: string, agora: number): number {
  const criado = new Date(iso).getTime();
  if (Number.isNaN(criado)) return 0;
  return Math.max(0, Math.floor((agora - criado) / 86_400_000));
}

/**
 * Converte a lista crua em algo que a tela mostra, já ordenado.
 *
 * Mais recente primeiro: quem acabou de travar é quem ainda está tentando, e
 * costuma ser quem ligou para o suporte.
 */
export function listarCadastrosPendentes(
  usuarios: UsuarioBruto[] | null | undefined,
  agora: number,
): CadastroPendente[] {
  const pendentes: CadastroPendente[] = [];

  for (const usuario of usuarios ?? []) {
    if (!estaPendenteDeConfirmacao(usuario)) continue;

    const email = texto(usuario.email);
    // Sem e-mail não há o que reenviar nem como identificar a pessoa.
    if (!email) continue;

    const meta = usuario.user_metadata ?? usuario.raw_user_meta_data ?? {};
    const criadoEm = texto(usuario.created_at);

    pendentes.push({
      id: texto(usuario.id),
      email,
      criadoEm,
      empresa: texto(meta.company) || texto(meta.name),
      cnpj: texto(meta.cnpj),
      diasParado: criadoEm ? diasDesde(criadoEm, agora) : 0,
      enviadoEm: texto(usuario.confirmation_sent_at),
    });
  }

  return pendentes.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/**
 * Contas da mesma empresa dentro da lista.
 *
 * **Não conta tentativa de login.** Conta quantos *cadastros diferentes* a
 * mesma empresa criou e deixou pendentes — foi o padrão da Opção de Vida: dois
 * e-mails, mesmo CNPJ, mesmo dia, nenhum confirmado.
 *
 * Isso importa porque muda o diagnóstico: uma pessoa esquecendo de clicar é
 * comum; duas pessoas da mesma empresa esquecendo no mesmo dia é a mensagem não
 * chegando. Soltas na lista, ninguém relaciona as duas.
 *
 * O rótulo na tela já disse "tentativas" e foi lido como tentativa de login —
 * por isso agora diz "cadastros".
 */
export function agruparPorEmpresa(pendentes: CadastroPendente[]): Map<string, CadastroPendente[]> {
  const grupos = new Map<string, CadastroPendente[]>();
  for (const item of pendentes) {
    const chave = (item.cnpj.replace(/\D/g, "") || item.empresa.toLowerCase()) || item.email;
    const atual = grupos.get(chave);
    if (atual) atual.push(item);
    else grupos.set(chave, [item]);
  }
  return grupos;
}
