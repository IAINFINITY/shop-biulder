/**
 * Aplica a configuração de autenticação do Supabase pela API de administração.
 *
 * ## Por que existe
 *
 * Três ajustes vivem no painel do Supabase, não no repositório — e por isso
 * ficam invisíveis para quem lê o código. Este script os torna versionados e
 * repetíveis, do mesmo jeito que `aplicar-migration.mjs` fez com o schema.
 *
 * ## O que muda, e por quê
 *
 * 1. `password_hibp_enabled = true`
 *    O Supabase tem checagem de senha vazada nativa, e estava desligada. Nós já
 *    temos a nossa (`api/senha-vazada.ts`), mas ela **falha aberta** de
 *    propósito: se o HIBP não responder, a senha passa. Foi esse comportamento
 *    que escondeu o bug do `res.send` por dias. A checagem do servidor cobre
 *    esse buraco, onde não há como pular.
 *
 * 2. `password_min_length = 10`
 *    O Supabase aceitava 6; `src/lib/senha.ts` exige 10. Qualquer caminho que
 *    escape da validação do cliente entrava com 6. Alinhar fecha isso.
 *
 * 3. Assunto e corpo do aviso de troca de senha, em português.
 *    O texto padrão vinha em inglês, num site em português. O template aceita
 *    apenas `{{ .Email }}` — não há variável de data nem de URL, então o link
 *    de recuperação é fixo.
 *
 * ## Uso
 *
 *   node scripts/configurar-auth-supabase.mjs --dry      mostra o diff, nao aplica
 *   node scripts/configurar-auth-supabase.mjs            aplica e confere
 *   node scripts/configurar-auth-supabase.mjs --restaurar volta ao backup
 *
 * O backup dos valores anteriores é gravado ao lado, em
 * `auth-config-backup.json`, antes de qualquer escrita.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARQUIVO_BACKUP = path.join(raiz, "scripts", "auth-config-backup.json");

function lerEnv() {
  const acumulado = {};
  for (const nome of [".env", ".env.local"]) {
    const caminho = path.join(raiz, nome);
    if (!fs.existsSync(caminho)) continue;
    for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
      if (!linha.includes("=") || linha.trim().startsWith("#")) continue;
      const corte = linha.indexOf("=");
      acumulado[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return acumulado;
}

const env = lerEnv();
const projeto = env.VITE_SUPABASE_PROJECT_ID;
const token = env.SUPABASE_ACCESS_TOKEN;

if (!projeto || !token) {
  console.error("Faltam VITE_SUPABASE_PROJECT_ID e/ou SUPABASE_ACCESS_TOKEN no .env");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${projeto}/config/auth`;
const CABECALHOS = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const CORPO_DO_AVISO = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px">

  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px">Sua senha foi alterada</h2>

  <p style="margin:0 0 16px">
    A senha da conta <strong>{{ .Email }}</strong> na Clinicmais Suplemento e Nutrição acabou de ser alterada.
  </p>

  <p style="margin:0 0 20px">
    Se foi você, não precisa fazer nada. Este aviso é só para você ficar sabendo.
  </p>

  <div style="border-left:3px solid #dc2626;background:#fef2f2;padding:14px 16px;margin:0 0 20px">
    <p style="margin:0 0 10px;font-weight:600;color:#991b1b">Não foi você?</p>
    <p style="margin:0 0 10px">
      Então alguém tem acesso à sua conta. Faça agora, nesta ordem:
    </p>
    <ol style="margin:0;padding-left:20px">
      <li style="margin-bottom:6px">
        Recupere o acesso em
        <a href="https://catalogo-clinicmais.iainfinity.com.br/recuperar-senha" style="color:#dc2626;font-weight:600">catalogo-clinicmais.iainfinity.com.br/recuperar-senha</a>
      </li>
      <li style="margin-bottom:6px">Escolha uma senha que você não use em nenhum outro site.</li>
      <li>Avise seu consultor da Clinicmais para conferirmos os pedidos recentes da sua empresa.</li>
    </ol>
  </div>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    Este e-mail é automático — não responda. A Clinicmais nunca pede sua senha por e-mail, telefone ou WhatsApp.
  </p>

</div>`;

/**
 * Confirmação de cadastro.
 *
 * O botão é a única coisa que a pessoa precisa fazer, então ele domina. A URL
 * aparece embaixo em texto porque cliente de e-mail corporativo às vezes
 * bloqueia o estilo do botão e sobra um link invisível — e aí a pessoa fica
 * sem saída.
 *
 * "Não foi você?" aqui é diferente do aviso de senha: **nada acontece** se
 * ignorar. A conta só existe de verdade depois da confirmação. Dizer isso
 * evita o e-mail virar motivo de preocupação à toa.
 */
const CORPO_DA_CONFIRMACAO = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px">

  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px">Confirme seu e-mail</h2>

  <p style="margin:0 0 16px">
    Falta um passo para sua conta na Clinicmais Suplemento e Nutrição ficar pronta. Confirme este endereço
    e você já entra com preços da sua empresa, histórico de pedidos e recompra.
  </p>

  <p style="margin:0 0 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:8px">
      Confirmar meu e-mail
    </a>
  </p>

  <p style="margin:0 0 20px;font-size:13px;color:#6b7280">
    O botão não funcionou? Copie e cole este endereço no navegador:<br>
    <span style="word-break:break-all;color:#4b5563">{{ .ConfirmationURL }}</span>
  </p>

  <p style="margin:0 0 20px;font-size:14px;color:#4b5563">
    O link vale por 1 hora. Depois disso, basta pedir um novo na tela de cadastro.
  </p>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    Não foi você que se cadastrou? Ignore este e-mail — sem a confirmação, nenhuma
    conta é ativada e nada acontece. Este e-mail é automático; não responda.
  </p>

</div>`;

/**
 * Recuperação de senha.
 *
 * Este é o e-mail que um atacante consegue disparar para a caixa de outra
 * pessoa: basta saber o endereço. Por isso o parágrafo "não foi você" precisa
 * ser tranquilizador e **específico** — a senha continua a mesma, ninguém
 * entrou, e ignorar resolve. Alarmar aqui produz ligação para o suporte e treina
 * a pessoa a clicar no link para "resolver", que é exatamente o que o golpe quer.
 */
const CORPO_DA_RECUPERACAO = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px">

  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px">Criar uma nova senha</h2>

  <p style="margin:0 0 16px">
    Recebemos um pedido para redefinir a senha da sua conta na Clinicmais Suplemento e Nutrição.
    Clique no botão para escolher uma nova.
  </p>

  <p style="margin:0 0 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:8px">
      Criar nova senha
    </a>
  </p>

  <p style="margin:0 0 20px;font-size:13px;color:#6b7280">
    O botão não funcionou? Copie e cole este endereço no navegador:<br>
    <span style="word-break:break-all;color:#4b5563">{{ .ConfirmationURL }}</span>
  </p>

  <p style="margin:0 0 20px;font-size:14px;color:#4b5563">
    O link vale por 1 hora e só pode ser usado uma vez.
  </p>

  <div style="border-left:3px solid #d1d5db;background:#f9fafb;padding:14px 16px;margin:0 0 20px">
    <p style="margin:0;font-size:14px;color:#4b5563">
      <strong style="color:#1f2937">Não foi você que pediu?</strong><br>
      Pode ignorar este e-mail. Sua senha continua a mesma e ninguém entrou na sua
      conta — nada muda enquanto o link não for usado.
    </p>
  </div>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    Este e-mail é automático — não responda. A Clinicmais nunca pede sua senha por
    e-mail, telefone ou WhatsApp.
  </p>

</div>`;

/**
 * O endereço do site, usado como destino padrão dos links de e-mail.
 *
 * Estava `http://localhost:3000` em produção, e isso vazava em dois lugares:
 *
 * 1. **Confirmação de cadastro.** `signUpCustomer` não passa `emailRedirectTo`,
 *    então o link do e-mail cai aqui — em produção, mandava a pessoa para
 *    `localhost:3000`, que não existe na máquina dela.
 * 2. **Rótulo do autenticador.** O Supabase montava a URI do TOTP a partir
 *    deste valor, e o app do celular mostrava "localhost:3000". Isso já foi
 *    resolvido de outro jeito — `useMfa` passa o `issuer` explicitamente — mas
 *    a origem do problema era esta.
 *
 * **Seguro de trocar:** o único ponto do código que define destino de e-mail é
 * a recuperação de senha (`useAuth.ts`), e ela usa `window.location.origin`.
 * Não depende deste valor e não muda de comportamento.
 */
const SITE_URL = "https://catalogo-clinicmais.iainfinity.com.br";

/**
 * Passkey (WebAuthn) — **nao da para ligar por aqui**.
 *
 * Tentado em 08/08 e recusado pela propria API:
 *
 *   PATCH 422 {"message":"Enabling of MFA with WebAuthn not currently supported"}
 *
 * O botao "Usar biometria ou chave de seguranca" existia na tela e devolvia
 * `MFA enroll is disabled for WebAuthn` ao ser clicado. Como o interruptor nao
 * esta disponivel, a saida honesta foi **esconder o botao** ate que esteja —
 * ver `VITE_PASSKEY_HABILITADO` em `useMfa.ts`.
 *
 * Isso mantem o item 3.2 do PERFIL-CLINIC-PLUS.md com uma ressalva: a §11 pede
 * que uma opcao resistente a phishing esteja **disponivel**, e hoje ela nao
 * esta. A EX-002 foi dada por encerrada quando o SDK passou a expor WebAuthn;
 * faltava conferir o lado do servidor, que e onde ela esbarra.
 *
 * O PATCH e atomico: deixar os dois campos aqui derrubava as outras seis
 * mudancas junto.
 */

/**
 * Aviso quando um autenticador é cadastrado ou removido.
 *
 * É o par do aviso de troca de senha, e cobre o caso que a própria tela da conta
 * descreve: *"se algum aqui não for seu, remova e troque sua senha."* Sem o
 * e-mail, a pessoa só descobre um fator estranho se for olhar a lista.
 *
 * Os dois templates aceitam `{{ .Email }}` e `{{ .FactorType }}`.
 */
const CORPO_FATOR_CADASTRADO = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px">

  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px">Novo autenticador na sua conta</h2>

  <p style="margin:0 0 16px">
    Um novo método de verificação em duas etapas ({{ .FactorType }}) foi cadastrado
    na conta <strong>{{ .Email }}</strong>.
  </p>

  <p style="margin:0 0 20px">
    Se foi você, não precisa fazer nada.
  </p>

  <div style="border-left:3px solid #dc2626;background:#fef2f2;padding:14px 16px;margin:0 0 20px">
    <p style="margin:0;color:#991b1b">
      <strong>Não foi você?</strong> Então alguém tem acesso à sua conta. Troque sua senha
      agora em
      <a href="https://catalogo-clinicmais.iainfinity.com.br/recuperar-senha" style="color:#dc2626;font-weight:600">recuperar senha</a>
      e avise seu consultor da Clinicmais.
    </p>
  </div>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    Este e-mail é automático — não responda. A Clinicmais nunca pede sua senha por e-mail, telefone ou WhatsApp.
  </p>

</div>`;

const CORPO_FATOR_REMOVIDO = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px">

  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px">Um autenticador foi removido</h2>

  <p style="margin:0 0 16px">
    O método de verificação em duas etapas ({{ .FactorType }}) foi removido da conta
    <strong>{{ .Email }}</strong>. Sua conta passa a ser protegida apenas pela senha.
  </p>

  <p style="margin:0 0 20px">
    Se foi você, não precisa fazer nada. Você pode cadastrar outro quando quiser.
  </p>

  <div style="border-left:3px solid #dc2626;background:#fef2f2;padding:14px 16px;margin:0 0 20px">
    <p style="margin:0;color:#991b1b">
      <strong>Não foi você?</strong> Troque sua senha agora em
      <a href="https://catalogo-clinicmais.iainfinity.com.br/recuperar-senha" style="color:#dc2626;font-weight:600">recuperar senha</a>
      e avise seu consultor da Clinicmais.
    </p>
  </div>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    Este e-mail é automático — não responda.
  </p>

</div>`;

const MUDANCAS = {
  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_subjects_mfa_factor_enrolled_notification: "Novo autenticador na sua conta — Clinicmais Suplemento e Nutrição",
  mailer_templates_mfa_factor_enrolled_notification_content: CORPO_FATOR_CADASTRADO,

  mailer_notifications_mfa_factor_unenrolled_enabled: true,
  mailer_subjects_mfa_factor_unenrolled_notification: "Um autenticador foi removido — Clinicmais Suplemento e Nutrição",
  mailer_templates_mfa_factor_unenrolled_notification_content: CORPO_FATOR_REMOVIDO,

  site_url: SITE_URL,

  /**
   * Nome que aparece como remetente na caixa de entrada.
   *
   * Era "Clinic+". O nome completo identifica melhor a empresa — e este e o
   * lugar certo para ele: o remetente e mostrado separado do assunto, entao o
   * espaco nao disputa com a mensagem.
   */
  smtp_sender_name: "Clinicmais Suplemento e Nutrição",

  password_hibp_enabled: true,
  password_min_length: 10,
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: "Sua senha foi alterada — Clinicmais Suplemento e Nutrição",
  mailer_templates_password_changed_notification_content: CORPO_DO_AVISO,

  mailer_subjects_confirmation: "Confirme seu e-mail para ativar sua conta — Clinicmais Suplemento e Nutrição",
  mailer_templates_confirmation_content: CORPO_DA_CONFIRMACAO,

  mailer_subjects_recovery: "Criar uma nova senha — Clinicmais Suplemento e Nutrição",
  mailer_templates_recovery_content: CORPO_DA_RECUPERACAO,
};

function resumir(valor) {
  if (typeof valor !== "string") return String(valor);
  const limpo = valor.replace(/\s+/g, " ");
  return limpo.length > 70 ? `${limpo.slice(0, 67)}...` : limpo;
}

async function lerConfig() {
  const resposta = await fetch(API, { headers: CABECALHOS });
  if (!resposta.ok) throw new Error(`GET falhou: ${resposta.status} ${await resposta.text()}`);
  return resposta.json();
}

const flags = process.argv.slice(2);
const soMostrar = flags.includes("--dry");
const restaurar = flags.includes("--restaurar");

const atual = await lerConfig();

if (restaurar) {
  if (!fs.existsSync(ARQUIVO_BACKUP)) {
    console.error(`Sem backup em ${ARQUIVO_BACKUP} — nada a restaurar.`);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(ARQUIVO_BACKUP, "utf8"));
  const r = await fetch(API, { method: "PATCH", headers: CABECALHOS, body: JSON.stringify(backup) });
  console.log(r.ok ? "Restaurado a partir do backup." : `Falhou: ${r.status} ${await r.text()}`);
  process.exit(r.ok ? 0 : 1);
}

console.log("Mudancas previstas:\n");
let algoMuda = false;
for (const [chave, novo] of Object.entries(MUDANCAS)) {
  const igual = atual[chave] === novo;
  if (!igual) algoMuda = true;
  console.log(`  ${igual ? "=" : "~"} ${chave}`);
  if (!igual) {
    console.log(`      antes:  ${resumir(atual[chave])}`);
    console.log(`      depois: ${resumir(novo)}`);
  }
}

if (!algoMuda) {
  console.log("\nNada a fazer — a configuracao ja esta como se quer.");
  process.exit(0);
}

if (soMostrar) {
  console.log("\n--dry: nada foi aplicado.");
  process.exit(0);
}

// Backup antes de escrever, sempre.
const backup = Object.fromEntries(Object.keys(MUDANCAS).map((k) => [k, atual[k]]));
fs.writeFileSync(ARQUIVO_BACKUP, JSON.stringify(backup, null, 2), "utf8");
console.log(`\nBackup gravado em scripts/auth-config-backup.json`);

const resposta = await fetch(API, { method: "PATCH", headers: CABECALHOS, body: JSON.stringify(MUDANCAS) });
if (!resposta.ok) {
  console.error(`PATCH falhou: ${resposta.status} ${(await resposta.text()).slice(0, 300)}`);
  process.exit(1);
}

const depois = await lerConfig();
console.log("\nConferindo o que ficou gravado:\n");
let tudoOk = true;
for (const [chave, esperado] of Object.entries(MUDANCAS)) {
  const bateu = depois[chave] === esperado;
  if (!bateu) tudoOk = false;
  console.log(`  ${bateu ? "OK      " : "DIVERGIU"} ${chave}`);
}
console.log(tudoOk ? "\nAplicado." : "\nAlgum campo nao ficou como pedido — confira no painel.");
process.exit(tudoOk ? 0 : 1);
