export function normalizeAuthMessage(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isRegisteredEmailAuthMessage(message: string) {
  const normalized = normalizeAuthMessage(message);
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already exists") ||
    normalized.includes("email already exists") ||
    normalized.includes("email exists") ||
    normalized.includes("ja esta cadastrado")
  );
}

/**
 * As saidas desta funcao, para reconhecer a propria resposta.
 *
 * Existe por causa de um bug real: a mensagem era traduzida duas vezes e a
 * segunda passagem nao reconhecia o portugues da primeira, derrubando tudo no
 * texto generico. Ver a guarda em `translateAuthErrorMessage`.
 */
const JA_TRADUZIDAS = new Set([
  "Erro ao autenticar.",
  "Este CNPJ já possui cadastro. Se a empresa já existe, entre com a conta correta ou fale com o suporte.",
  "E-mail ou senha incorretos. Confira os dados e tente novamente.",
  "O e-mail informado não parece válido. Revise o endereço antes de continuar.",
  "A senha informada não atende aos requisitos de segurança.",
  "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.",
  "Não foi possível concluir. Verifique os dados e tente de novo.",
]);

/**
 * Mensagem de erro de autenticacao, sem contar quem existe.
 *
 * A §21 do padrao exige comportamento **observavel equivalente** para conta
 * inexistente, senha incorreta, conta suspensa, recuperacao de conta inexistente
 * e cadastro com identificador existente. Mensagem diferente e diferenca
 * observavel — bastava um formulario e uma lista de e-mails para levantar quem e
 * cliente da Clinic+.
 *
 * O parametro `duplicateEmailText` continua na assinatura para nao quebrar quem
 * chama, mas **e ignorado**: nao ha texto de "ja cadastrado" que seja seguro.
 */
export function translateAuthErrorMessage(message: string, _options?: { duplicateEmailText?: string }) {
  const normalized = normalizeAuthMessage(message || "");

  if (!normalized) return "Erro ao autenticar.";

  // Idempotencia: esta funcao ja recebeu a propria saida.
  //
  // `signIn` devolvia o texto ja traduzido e a tela traduzia de novo. O
  // portugues nao casava com nenhum ramo abaixo, entao **toda** falha de login
  // virava "Nao foi possivel concluir" — o sintoma que o cliente relatou. A
  // chamada dupla foi removida; esta guarda existe para que, se voltar, o
  // resultado seja o texto certo em vez do generico.
  if (JA_TRADUZIDAS.has(message.trim())) return message.trim();

  // CNPJ e diferente de e-mail: quem digita um CNPJ ja e a empresa dona dele, e a
  // informacao nao serve para varrer terceiros. Fica.
  if (normalized.includes("customer_profiles_cnpj_unique") || (normalized.includes("duplicate") && normalized.includes("cnpj"))) {
    return "Este CNPJ já possui cadastro. Se a empresa já existe, entre com a conta correta ou fale com o suporte.";
  }

  // As tres condicoes abaixo cabiam em ramos distintos e cada texto denunciava um
  // estado: "nao confirmado" e "ja cadastrado" provam que a conta existe;
  // "credencial invalida" nao prova nada. Agora as tres respondem igual.
  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("incorrect password") ||
    normalized.includes("senha incorreta") ||
    normalized.includes("email not confirmed") ||
    normalized.includes("email not verified") ||
    isRegisteredEmailAuthMessage(normalized)
  ) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (normalized.includes("invalid email")) {
    return "O e-mail informado não parece válido. Revise o endereço antes de continuar.";
  }

  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("short"))) {
    return "A senha informada não atende aos requisitos de segurança.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.";
  }

  // Mensagem crua do provedor pode descrever estado interno da conta.
  console.warn("[auth] mensagem sem tradução:", message);
  return "Não foi possível concluir. Verifique os dados e tente de novo.";
}

/**
 * O que impediu o login.
 *
 * ## Por que classificar, se a mensagem tem que ser generica
 *
 * Nem toda falha e a mesma coisa, e tratar as tres como uma so foi o que deixou
 * o cliente sem saber o que fazer. A §21 exige que **conta inexistente** e
 * **senha incorreta** sejam indistinguiveis — e continuam sendo, as duas caem em
 * `credencial`. O que ela nao exige e esconder `email_nao_confirmado`.
 *
 * ## Por que `email_nao_confirmado` pode ser dito
 *
 * Porque o Supabase so devolve `email_not_confirmed` **depois de a senha bater**.
 * Medido contra o projeto em 24/08/2026, com uma conta sonda nao confirmada:
 *
 * | tentativa                        | resposta              |
 * |----------------------------------|-----------------------|
 * | senha errada, conta nao confirmada | `invalid_credentials` |
 * | senha certa, conta nao confirmada  | `email_not_confirmed` |
 * | conta inexistente                  | `invalid_credentials` |
 *
 * Quem ve "confirme seu e-mail" ja provou ter a senha correta daquela conta —
 * nao aprendeu nada que a senha na mao dele ja nao dissesse. O varredor que so
 * tem uma lista de e-mails continua recebendo `credencial` para tudo.
 *
 * Se um dia essa ordem mudar no provedor, esta distincao vira vazamento. A
 * medicao acima e a premissa, e nao ha teste automatico que a verifique — ela
 * depende do servidor. Refazer a sonda antes de mexer nesta funcao.
 */
export type TipoDeFalhaDeLogin =
  | "credencial"
  | "email_nao_confirmado"
  | "muitas_tentativas"
  | "desconhecido";

export type FalhaDeLogin = {
  tipo: TipoDeFalhaDeLogin;
  /** Texto ja pronto para a tela. Nunca a mensagem crua do provedor. */
  mensagem: string;
};

/**
 * Erro de login que carrega o motivo.
 *
 * `signIn` devolvia um `Error` com o texto ja traduzido, e a tela **traduzia de
 * novo** — o texto em portugues nao casava com nenhum ramo e caia no generico
 * "Nao foi possivel concluir". Era por isso que nenhuma tentativa de login dizia
 * coisa alguma, nem senha errada, nem e-mail pendente.
 *
 * Com o motivo no objeto, a tela decide a **acao** que oferece (reenviar
 * confirmacao, recuperar senha) sem reinterpretar string.
 */
export class ErroDeLogin extends Error {
  readonly tipo: TipoDeFalhaDeLogin;

  constructor(falha: FalhaDeLogin) {
    super(falha.mensagem);
    this.name = "ErroDeLogin";
    this.tipo = falha.tipo;
  }
}

/** Texto unico de "credencial" — conta inexistente e senha errada respondem igual. */
export const MENSAGEM_DE_CREDENCIAL = "E-mail ou senha incorretos. Confira os dados e tente novamente.";

/**
 * Classifica a falha de login a partir do `code` e da mensagem do provedor.
 *
 * O `code` vem primeiro porque e estavel; a mensagem e fallback para versao de
 * SDK que nao o preenche.
 */
export function classificarFalhaDeLogin(message: string, codigo?: string): FalhaDeLogin {
  const normalizada = normalizeAuthMessage(message || "");
  const cod = (codigo || "").toLowerCase();

  if (cod === "email_not_confirmed" || normalizada.includes("email not confirmed") || normalizada.includes("email not verified")) {
    return {
      tipo: "email_nao_confirmado",
      mensagem: "Falta confirmar seu e-mail. Abra a mensagem que enviamos e clique no link para liberar o acesso.",
    };
  }

  if (
    cod === "over_request_rate_limit" ||
    cod === "over_email_send_rate_limit" ||
    normalizada.includes("rate limit") ||
    normalizada.includes("too many requests")
  ) {
    return {
      tipo: "muitas_tentativas",
      mensagem: "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.",
    };
  }

  if (
    cod === "invalid_credentials" ||
    normalizada.includes("invalid login") ||
    normalizada.includes("invalid credentials") ||
    normalizada.includes("incorrect password") ||
    isRegisteredEmailAuthMessage(normalizada)
  ) {
    return { tipo: "credencial", mensagem: MENSAGEM_DE_CREDENCIAL };
  }

  if (cod === "user_banned") {
    // Conta suspensa responde como credencial: a §21 lista esse caso junto com
    // "conta inexistente". Quem esta suspenso descobre pelo suporte, nao aqui.
    return { tipo: "credencial", mensagem: MENSAGEM_DE_CREDENCIAL };
  }

  console.warn("[auth] falha de login sem classificação:", codigo || "(sem code)", message);
  return { tipo: "desconhecido", mensagem: "Não foi possível entrar agora. Tente novamente em instantes." };
}
