import { useEffect, useState, type ReactNode } from "react";
import { Fingerprint, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { suportaPasskey, useMfa } from "@/hooks/useMfa";
import { CadastroDeFator } from "@/components/auth/CadastroDeFator";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * Portao de segundo fator do site inteiro.
 *
 * Fica no `AppRoutes`, ao lado dos desvios de `isPasswordRecovery` e
 * `deveTrocarSenha` — a mesma forma, pelo mesmo motivo. O comentario do
 * `deveTrocarSenha` ja dizia: *"a tela dizia que devem trocar no primeiro
 * acesso; nada obrigava. Este e o controle que faltava para a promessa virar
 * verdade."* Aqui a promessa e a da pagina da conta: *"estes sao os dispositivos
 * que podem confirmar sua identidade."*
 *
 * ## Por que aqui, e nao na tela de login
 *
 * O login nao e o unico caminho para uma sessao `aal1`. Uma sessao restaurada
 * do armazenamento dias depois tambem e `aal1` — e entraria sem desafio se a
 * verificacao morasse so no formulario.
 *
 * Foi exatamente essa a licao do bug de 08/08: este componente vivia em
 * `pages/Admin.tsx`, estava correto e testado, e **nunca era montado**, porque a
 * rota `/admin` importava o painel direto. Verificacao presa a um ponto de rota
 * some quando a rota muda de forma. Alta na arvore, nao tem como ser contornada
 * por navegacao.
 *
 * ## Isto e conveniencia, nao a barreira
 *
 * Quem recusa de verdade e o servidor, em `api/_auth.ts`, olhando o `aal` de
 * dentro do token assinado. Se este portao fosse a unica defesa, bastaria
 * chamar `/api/*` direto — o que a §31 chama de "autenticacao ou autorizacao
 * somente no frontend".
 *
 * ## Enquanto carrega, deixa passar
 *
 * `useMfa` faz tres chamadas ao montar. Bloquear a tela ate elas responderem
 * poria uma espera em **todo** carregamento de pagina de quem esta logado, para
 * proteger o caso raro — hoje, uma conta com fator em 123. Quem nao tem fator
 * nunca deveria pagar por isso. O servidor continua recusando enquanto o
 * navegador ainda nao sabe.
 */
const TAMANHO_DO_CODIGO = 6;

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--page-header-shell-height,88px))] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        {children}
      </div>
    </div>
  );
}

function CampoDeCodigo({
  valor,
  onChange,
  onEnviar,
  ocupado,
}: {
  valor: string;
  onChange: (v: string) => void;
  onEnviar: () => void;
  ocupado: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="mfa-codigo" className={cn(TEXT.compact, "font-medium")}>
        Código de 6 dígitos
      </Label>
      <Input
        id="mfa-codigo"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, TAMANHO_DO_CODIGO))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valor.length === TAMANHO_DO_CODIGO) onEnviar();
        }}
        inputMode="numeric"
        // `one-time-code` faz o iOS e o Android oferecerem o codigo direto do
        // teclado, em vez de obrigar a alternar de aplicativo e voltar.
        autoComplete="one-time-code"
        placeholder="000000"
        className="h-12 text-center text-xl tracking-[0.4em] tabular-nums"
        disabled={ocupado}
        autoFocus
      />
    </div>
  );
}

export function GuardaDeSegundoFator({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  const { signOut } = useAuth();
  const { carregando, exigencia, erro, fatores, confirmarCodigo, autenticarComPasskey } = useMfa(isAdmin);

  // `suportaPasskey` cobre as duas pontas: navegador capaz e recurso ligado no
  // projeto. A segunda hoje e `false` — o Supabase recusa ligar WebAuthn. Sem
  // ela, uma conta que ja tivesse um fator desses veria o botao e receberia
  // `MFA verify is disabled for WebAuthn` no clique, presa na tela.
  const passkeyVerificado = suportaPasskey()
    ? fatores.find((f) => f.tipo === "webauthn" && f.status === "verified")
    : undefined;

  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const precisaCadastrar = exigencia?.estado === "cadastro_necessario";

  // Enquanto nao se sabe, o site segue — ver a nota no topo. O servidor recusa
  // no lugar do navegador nesse intervalo.
  if (carregando || !exigencia) return <>{children}</>;

  if (exigencia.estado === "liberado") return <>{children}</>;

  /**
   * Envolve as duas acoes de passkey no mesmo tratamento de erro.
   *
   * Cancelar o prompt do navegador rejeita a promessa — e isso nao e falha, e a
   * pessoa mudando de ideia. Mostrar "erro" ali assustaria sem motivo.
   */
  const usarPasskey = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setFalha(null);
    try {
      await acao();
    } catch (e) {
      const nome = (e as { name?: string })?.name;
      if (nome === "NotAllowedError" || nome === "AbortError") return;
      setFalha((e as { message?: string })?.message ?? "Não foi possível usar a chave.");
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async (fatorId: string) => {
    setOcupado(true);
    setFalha(null);
    try {
      await confirmarCodigo(fatorId, codigo);
      setCodigo("");
    } catch (e) {
      // Mensagem do proprio Supabase quando o codigo nao confere; ela ja
      // distingue codigo errado de codigo expirado.
      setFalha((e as { message?: string })?.message ?? "Código inválido.");
      setCodigo("");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Moldura>
      <div className="flex items-center gap-3 pb-4">
        {precisaCadastrar ? (
          <ShieldAlert className="h-6 w-6 shrink-0 text-primary" />
        ) : (
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
        )}
        <div className="min-w-0">
          <h1 className={cn(TEXT.body, "font-semibold text-foreground")}>
            {precisaCadastrar ? "Ative a verificação em duas etapas" : "Confirme que é você"}
          </h1>
          <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>{exigencia.motivo}</p>
        </div>
      </div>

      {precisaCadastrar ? (
        <CadastroDeFator isAdmin={isAdmin} />
      ) : (
        <div className="space-y-4">
          {passkeyVerificado ? (
            <>
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-full"
                disabled={ocupado}
                onClick={() => void usarPasskey(() => autenticarComPasskey(passkeyVerificado.id))}
              >
                <Fingerprint className="h-4 w-4" />
                Entrar com biometria ou chave
              </Button>
              <p className={cn(TEXT.caption, "text-center text-muted-foreground")}>ou use o código do aplicativo</p>
            </>
          ) : null}
          <DesafioDeCodigo
            fatorVerificadoId={fatores.find((f) => f.tipo === "totp" && f.status === "verified")?.id ?? null}
            codigo={codigo}
            setCodigo={setCodigo}
            ocupado={ocupado}
            onEnviar={enviar}
          />
        </div>
      )}

      {(falha || erro) && (
        <p className={cn(TEXT.caption, "mt-3 text-destructive")} role="alert">
          {falha ?? erro}
        </p>
      )}

      {/* A saída.

          Sem ela isto é uma parede: quem perdeu o celular, trocou de aparelho ou
          simplesmente não tem o código à mão fica preso numa tela sem link
          nenhum — nem para o catálogo, nem para sair. E como o portão cobre o
          site inteiro, "ir para outro lugar" deixou de ser uma saída.

          Sair não contorna a proteção: derruba a sessão. O caminho de volta é a
          recuperação de senha, que é a única rota fora do portão. */}
      <div className="mt-6 flex flex-col items-center gap-2 border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(TEXT.caption, "text-muted-foreground underline underline-offset-2 hover:text-foreground")}
        >
          Sair da conta
        </button>
        <p className={cn(TEXT.caption, "text-center text-muted-foreground")}>
          Perdeu o acesso ao aplicativo? Saia e use{" "}
          <Link to="/recuperar-senha" className="text-primary underline underline-offset-2">
            recuperar senha
          </Link>
          .
        </p>
      </div>
    </Moldura>
  );
}

/**
 * O id do fator vem por prop, e nao de um `useMfa` proprio: um segundo hook aqui
 * dispararia de novo `listFactors` e `getAuthenticatorAssuranceLevel` a cada
 * render do portao, para responder o que o pai ja sabe.
 */
function DesafioDeCodigo({
  fatorVerificadoId,
  codigo,
  setCodigo,
  ocupado,
  onEnviar,
}: {
  fatorVerificadoId: string | null;
  codigo: string;
  setCodigo: (v: string) => void;
  ocupado: boolean;
  onEnviar: (fatorId: string) => void | Promise<void>;
}) {
  if (!fatorVerificadoId) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className={TEXT.compact}>Carregando o autenticador…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CampoDeCodigo
        valor={codigo}
        onChange={setCodigo}
        onEnviar={() => void onEnviar(fatorVerificadoId)}
        ocupado={ocupado}
      />
      <Button
        type="button"
        className="h-11 w-full rounded-full"
        disabled={codigo.length !== TAMANHO_DO_CODIGO || ocupado}
        onClick={() => void onEnviar(fatorVerificadoId)}
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
      </Button>
    </div>
  );
}
