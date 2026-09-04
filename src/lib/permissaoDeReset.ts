/**
 * Quem pode devolver uma conta à senha provisória.
 *
 * ## O que estava errado
 *
 * A rota exigia `superadmin`. Só que o resto do CRUD de funcionário — criar,
 * editar — já aceita **superadmin ou admin com `permissions.funcionarios`**;
 * `create-employee-user` até documenta a correção. O reset ficou para trás.
 *
 * O resultado é um admin que cadastra o funcionário, edita o cadastro dele,
 * apaga se precisar — e não consegue devolvê-lo à senha provisória quando ele
 * esquece a senha. A operação mais banal das três é a única bloqueada.
 *
 * E o bloqueio não comprava segurança: quem pode **criar** funcionário já cria
 * contas com a senha provisória conhecida, e quem tem a seção já lê essa senha
 * pelo `GET` da mesma rota.
 *
 * ## ⚠️ A armadilha que abrir isso cria
 *
 * A rota nunca olhou **quem é o alvo**. Para superadmin tudo bem: ele já podia
 * tudo. Estendida a admins sem esse cuidado, ela vira escada de privilégio —
 * um admin com a permissão `funcionarios` resetaria a senha do **superadmin**,
 * entraria com a provisória e assumiria a conta.
 *
 * Daí a regra assimétrica abaixo: superadmin continua podendo em qualquer conta;
 * admin com a permissão só age sobre **funcionário que não seja da equipe**.
 * Fora disso, a resposta é não.
 */

export type ContextoDeReset = {
  /** Quem chamou é superadmin. */
  ehSuperadmin: boolean;
  /** Quem chamou tem `permissions.funcionarios === true`. */
  temPermissaoDeFuncionarios: boolean;
  /** O alvo é uma conta de funcionário (`customer_type = 'funcionario'`). */
  alvoEhFuncionario: boolean;
  /** O alvo tem papel de admin ou superadmin. */
  alvoEhDaEquipe: boolean;
  /** Quem chamou é o próprio alvo. */
  ehAPropriaConta: boolean;
};

export type DecisaoDeReset =
  | { permitido: true }
  | { permitido: false; motivo: string; detalhe?: string };

export function podeResetarSenha(contexto: ContextoDeReset): DecisaoDeReset {
  // Resetar a própria senha aqui deixa a pessoa trancada do lado de fora: a
  // conta sai com senha provisória e troca obrigatória, e a sessão cai no mesmo
  // movimento. Vale inclusive para o superadmin.
  if (contexto.ehAPropriaConta) {
    return {
      permitido: false,
      motivo: "Não é possível resetar a própria senha por aqui.",
      detalhe: "Use 'Esqueceu a senha?' ou a troca de senha na sua conta.",
    };
  }

  if (contexto.ehSuperadmin) return { permitido: true };

  if (!contexto.temPermissaoDeFuncionarios) {
    return {
      permitido: false,
      motivo: "Acesso restrito a quem administra funcionários.",
    };
  }

  // ⚠️ O ponto que impede a escada de privilégio.
  if (contexto.alvoEhDaEquipe) {
    return {
      permitido: false,
      motivo: "Só o superadministrador reseta a senha de quem é da equipe.",
      detalhe: "Esta conta tem acesso ao painel.",
    };
  }

  if (!contexto.alvoEhFuncionario) {
    return {
      permitido: false,
      motivo: "Esta permissão alcança apenas contas de funcionário.",
    };
  }

  return { permitido: true };
}
