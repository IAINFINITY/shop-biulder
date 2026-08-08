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
 * O logo, e por que ele mora em `public/`.
 *
 * O arquivo que o site usa (`src/assets/clinicmais-logo.png`) nao serve aqui por
 * dois motivos. E **WebP com extensao trocada** — o magic number e `RIFF....WEBP`
 * —, e o Outlook nao le WebP. E o Vite poe hash no nome ao empacotar, entao a URL
 * mudaria a cada build enquanto o e-mail ja enviado apontaria para o arquivo
 * velho.
 *
 * `public/email-logo.png` e PNG de verdade, tem nome estavel e foi achatado sobre
 * branco de proposito: o logo original tem fundo transparente, e o cinza do
 * "clinic" some contra o fundo escuro do Gmail em modo noturno.
 *
 * 360px de arquivo para 180px de exibicao — o dobro, por causa de tela retina.
 *
 * **Depende de deploy.** O arquivo so existe na URL depois que o front subir. Por
 * isso o script confere se ele responde antes de gravar os templates.
 */
const LOGO_URL = `${SITE_URL}/email-logo.png`;

/**
 * Suporte no rodape.
 *
 * A pesquisa de e-mail transacional trata isto como item obrigatorio, e era o que
 * faltava nos nossos: quem recebe um aviso de seguranca e nao reconhece a acao
 * precisa falar com alguem AGORA. Sem canal no proprio e-mail, a pessoa procura
 * no Google — e cai em qualquer coisa.
 *
 * Mesmos valores de `src/lib/supportContact.ts` e do rodape do site. Repetidos
 * aqui porque este script nao importa nada de `src/`.
 */
const SUPORTE_WHATSAPP = "https://wa.me/554920209980";
const SUPORTE_EMAIL = "compras@clinicmais.com.br";

/**
 * A moldura comum dos cinco e-mails.
 *
 * Antes, cada template repetia cabecalho, fonte e rodape na mao. Cinco copias da
 * mesma coisa e cinco chances de uma sair diferente — foi assim que o medidor de
 * senha ficou com duas versoes, uma corrigida e a outra nao.
 *
 * ## Decisoes que parecem detalhe e nao sao
 *
 * **`width` e `height` como atributo, nao so no style.** O Outlook ignora
 * dimensao vinda de CSS e renderiza a imagem no tamanho original.
 *
 * **`alt` que se sustenta sozinho.** Cliente de e-mail bloqueia imagem externa
 * por padrao; o topo precisa dizer de quem e a mensagem mesmo sem carregar nada.
 *
 * **Fundo branco explicito.** Sem isso o modo escuro do Gmail inverte o fundo e
 * deixa texto cinza contra cinza.
 */
function montarEmail({ titulo, conteudo }) {
  return `<div style="background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:520px;padding:8px 0">

  <img src="${LOGO_URL}" width="180" height="52" alt="Clinicmais Suplemento e Nutrição"
       style="display:block;border:0;margin:0 0 26px;width:180px;height:auto">

  <h2 style="font-size:19px;font-weight:600;margin:0 0 16px;color:#111827">${titulo}</h2>

${conteudo}

  <div style="margin-top:26px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
    <p style="margin:0 0 10px">
      Precisa de ajuda? Fale com a gente no
      <a href="${SUPORTE_WHATSAPP}" style="color:#4b5563;font-weight:600">WhatsApp (49) 2020-9980</a>
      ou em <a href="mailto:${SUPORTE_EMAIL}" style="color:#4b5563;font-weight:600">${SUPORTE_EMAIL}</a>.
    </p>
    <p style="margin:0">
      Este e-mail é automático — não responda. A Clinicmais nunca pede sua senha por
      e-mail, telefone ou WhatsApp.
    </p>
  </div>

</div>`;
}

/** Bloco vermelho de "nao foi voce" — o mesmo alerta nos tres avisos de seguranca. */
function blocoAlerta(conteudo) {
  return `  <div style="border-left:3px solid #dc2626;background:#fef2f2;padding:14px 16px;margin:0 0 20px">
${conteudo}
  </div>`;
}

/**
 * Aviso de senha alterada.
 *
 * A ordem dos passos importa e nao e obvia: **retomar o acesso vem antes de
 * avisar o consultor**. Quem esta com a conta invadida perde tempo escrevendo
 * mensagem enquanto o invasor continua dentro. Fechar a porta primeiro.
 */
const CORPO_DO_AVISO = montarEmail({
  titulo: "Sua senha foi alterada",
  conteudo: `  <p style="margin:0 0 16px">
    Olá, {{ .Data.name }} — a senha da conta <strong>{{ .Email }}</strong> acabou de ser alterada.
  </p>

  <p style="margin:0 0 20px">
    Se foi você, está tudo certo e não precisa fazer nada. Este aviso existe para
    que uma troca que você não fez não passe despercebida.
  </p>

${blocoAlerta(`    <p style="margin:0 0 10px;font-weight:600;color:#991b1b">Não foi você?</p>
    <p style="margin:0 0 10px;color:#7f1d1d">
      Então alguém está com acesso à sua conta. Faça nesta ordem — primeiro fechar
      a porta, depois avisar:
    </p>
    <ol style="margin:0;padding-left:20px;color:#7f1d1d">
      <li style="margin-bottom:6px">
        Retome o acesso em
        <a href="${SITE_URL}/recuperar-senha" style="color:#dc2626;font-weight:600">recuperar senha</a>.
      </li>
      <li style="margin-bottom:6px">Escolha uma senha que você não use em nenhum outro site.</li>
      <li>Avise seu consultor para conferirmos os pedidos recentes da sua empresa.</li>
    </ol>`)}`,
});

/**
 * Confirmação de cadastro.
 *
 * O botão é a única coisa que a pessoa precisa fazer, então ele domina. A URL
 * aparece embaixo em texto porque cliente de e-mail corporativo às vezes bloqueia
 * o estilo do botão e sobra um link invisível — e aí a pessoa fica sem saída.
 *
 * "Não foi você?" aqui é diferente do aviso de senha: **nada acontece** se
 * ignorar. A conta só existe de verdade depois da confirmação. Dizer isso evita o
 * e-mail virar motivo de preocupação à toa.
 */
const CORPO_DA_CONFIRMACAO = montarEmail({
  titulo: "Confirme seu e-mail",
  conteudo: `  <p style="margin:0 0 16px">
    Olá, {{ .Data.name }} — falta um passo para liberar o acesso de
    <strong>{{ .Email }}</strong> ao catálogo.
  </p>

  <p style="margin:0 0 22px">
    Confirmando, você entra e já vê a tabela de preços da sua empresa, o histórico
    de pedidos e a recompra em um clique.
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

  <p style="margin:0;font-size:14px;color:#4b5563">
    O link vale por 1 hora. Se expirar, é só pedir outro na tela de cadastro.
    Não foi você que se cadastrou? Pode ignorar — sem a confirmação nenhuma conta
    é ativada.
  </p>`,
});

/**
 * Recuperação de senha.
 *
 * Este é o e-mail que um atacante consegue disparar para a caixa de outra pessoa:
 * basta saber o endereço. Por isso o parágrafo "não foi você" precisa ser
 * tranquilizador e **específico** — a senha continua a mesma, ninguém entrou, e
 * ignorar resolve. Alarmar aqui produz ligação para o suporte e treina a pessoa a
 * clicar no link para "resolver", que é exatamente o que o golpe quer.
 */
const CORPO_DA_RECUPERACAO = montarEmail({
  titulo: "Criar uma nova senha",
  conteudo: `  <p style="margin:0 0 22px">
    Olá, {{ .Data.name }} — recebemos um pedido para redefinir a senha de
    <strong>{{ .Email }}</strong>.
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
    O link vale por 1 hora e só funciona uma vez.
  </p>

${blocoAlerta(`    <p style="margin:0;color:#7f1d1d">
      <strong style="color:#991b1b">Não foi você que pediu?</strong> Pode ignorar
      este e-mail. Sua senha continua a mesma, ninguém entrou na sua conta e nada
      muda enquanto o link não for usado.
    </p>`)}`,
});

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
const CORPO_FATOR_CADASTRADO = montarEmail({
  titulo: "Novo autenticador na sua conta",
  conteudo: `  <p style="margin:0 0 16px">
    Olá, {{ .Data.name }} — um novo método de verificação em duas etapas
    ({{ .FactorType }}) foi cadastrado em <strong>{{ .Email }}</strong>.
  </p>

  <p style="margin:0 0 20px">
    Se foi você, está tudo certo. A partir de agora esse aparelho passa a ser
    pedido junto com a senha quando você entrar.
  </p>

${blocoAlerta(`    <p style="margin:0;color:#7f1d1d">
      <strong style="color:#991b1b">Não foi você?</strong> Então alguém está com
      acesso à sua conta. Retome o acesso em
      <a href="${SITE_URL}/recuperar-senha" style="color:#dc2626;font-weight:600">recuperar senha</a>,
      remova o autenticador desconhecido em Minha conta e avise seu consultor.
    </p>`)}`,
});

const CORPO_FATOR_REMOVIDO = montarEmail({
  titulo: "Um autenticador foi removido",
  conteudo: `  <p style="margin:0 0 16px">
    Olá, {{ .Data.name }} — o método de verificação em duas etapas
    ({{ .FactorType }}) foi removido de <strong>{{ .Email }}</strong>.
  </p>

  <p style="margin:0 0 20px">
    Sua conta volta a ser protegida apenas pela senha. Se foi você, não precisa
    fazer nada — dá para cadastrar outro quando quiser, em Minha conta.
  </p>

${blocoAlerta(`    <p style="margin:0;color:#7f1d1d">
      <strong style="color:#991b1b">Não foi você?</strong> Retome o acesso em
      <a href="${SITE_URL}/recuperar-senha" style="color:#dc2626;font-weight:600">recuperar senha</a>
      e avise seu consultor.
    </p>`)}`,
});

const MUDANCAS = {
  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_subjects_mfa_factor_enrolled_notification: "Novo autenticador na sua conta",
  mailer_templates_mfa_factor_enrolled_notification_content: CORPO_FATOR_CADASTRADO,

  mailer_notifications_mfa_factor_unenrolled_enabled: true,
  mailer_subjects_mfa_factor_unenrolled_notification: "Um autenticador foi removido",
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
  mailer_subjects_password_changed_notification: "Sua senha foi alterada",
  mailer_templates_password_changed_notification_content: CORPO_DO_AVISO,

  mailer_subjects_confirmation: "Confirme seu e-mail para entrar",
  mailer_templates_confirmation_content: CORPO_DA_CONFIRMACAO,

  mailer_subjects_recovery: "Redefinir sua senha",
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

/**
 * O logo precisa estar no ar ANTES do template que o aponta.
 *
 * A configuracao do Supabase e o deploy do front sao dois botoes separados, e
 * nada obriga a ordem. Rodando este script antes de o `public/email-logo.png`
 * subir, todo e-mail enviado no intervalo chega com o icone quebrado no topo —
 * justo em mensagens que precisam parecer legitimas. Aviso de senha alterada com
 * imagem falhando e exatamente o que um phishing parece.
 *
 * `text/html` na resposta significa que caiu no SPA, que devolve 200 para
 * qualquer caminho — foi assim que descobrimos que o logo nao estava publicado.
 * Por isso a checagem olha o `content-type`, nao o status.
 */
async function conferirLogo() {
  const url = LOGO_URL;
  try {
    const r = await fetch(url, { method: "GET" });
    const tipo = r.headers.get("content-type") ?? "";
    if (r.ok && tipo.startsWith("image/")) return true;
    console.error(`\nO logo do e-mail nao esta acessivel em ${url}`);
    console.error(`  resposta: ${r.status}, content-type: ${tipo || "(vazio)"}`);
    if (tipo.includes("html")) {
      console.error("  (isso e o SPA respondendo — o arquivo nao foi publicado ainda)");
    }
  } catch (e) {
    console.error(`\nNao deu para checar ${url}: ${e.message}`);
  }
  console.error("\nFaca o deploy do front primeiro; o arquivo vive em public/email-logo.png.");
  console.error("Para aplicar assim mesmo (os e-mails ficam sem logo): --ignorar-logo\n");
  return false;
}

const flags = process.argv.slice(2);
const soMostrar = flags.includes("--dry");
const restaurar = flags.includes("--restaurar");
const ignorarLogo = flags.includes("--ignorar-logo");

/**
 * `--previa` — grava os cinco e-mails como HTML para abrir no navegador.
 *
 * Vem antes de `lerConfig()` porque nao precisa de rede nem de credencial: e so
 * despejar as strings que este arquivo ja montou. Da para conferir o texto sem
 * tocar no projeto, e sem disparar e-mail de verdade para ninguem.
 *
 * As variaveis do Supabase ficam visiveis como `{{ .Data.name }}` mesmo — a
 * substituicao acontece no servidor, na hora do envio. Ver o marcador cru e util:
 * mostra exatamente onde cada dado entra.
 */
if (flags.includes("--previa")) {
  const destino = path.join(raiz, "scripts", "previa-emails");
  fs.mkdirSync(destino, { recursive: true });
  const paginas = Object.entries(MUDANCAS).filter(([k]) => k.startsWith("mailer_templates_"));
  for (const [chave, html] of paginas) {
    const nome = `${chave.replace("mailer_templates_", "").replace("_content", "")}.html`;
    fs.writeFileSync(path.join(destino, nome), html, "utf8");
    console.log(`  ${path.join("scripts", "previa-emails", nome)}`);
  }
  console.log(`\n${paginas.length} arquivos. Abra no navegador para conferir.`);
  process.exit(0);
}

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

// Depois do --dry de proposito: quem so quer VER o diff nao deveria esbarrar em
// deploy pendente. A trava vale para quem vai gravar.
if (!ignorarLogo && !(await conferirLogo())) process.exit(1);

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
