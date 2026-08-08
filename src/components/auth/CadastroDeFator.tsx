import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suportaPasskey, useMfa } from "@/hooks/useMfa";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * Cadastro de um segundo fator: senha -> QR -> codigo, com passkey ao lado.
 *
 * ## Por que e um componente proprio
 *
 * Este fluxo nasceu dentro do `MfaGate`, que so aparecia quando o painel estava
 * bloqueado. Quando o MFA passou a ser **opcional** para administrador, o portao
 * deixou de bloquear — e o cadastro ficaria inalcancavel para quem quisesse
 * ativar por conta propria. Extrair foi o que permitiu oferecer o mesmo fluxo na
 * pagina da conta sem duplicar a tela.
 *
 * ## A senha vem antes do QR
 *
 * A §12 e explicita: *"Registro DEVE exigir autenticacao recente"* e *"um cookie
 * de sessao antigo, isoladamente, NAO DEVE autorizar novo passkey"*. Uma sessao
 * restaurada do armazenamento dias depois nao prova nada — e gerar o segredo
 * antes da senha seria entrega-lo a quem nao provou.
 */

const TAMANHO_DO_CODIGO = 6;

export function CadastroDeFator({
  isAdmin,
  onConcluido,
}: {
  isAdmin: boolean;
  /** Chamado quando um fator passa a valer. */
  onConcluido?: () => void;
}) {
  const { iniciarCadastro, confirmarCodigo, cadastrarPasskey, reautenticar } = useMfa(isAdmin);

  const [senhaConfirmada, setSenhaConfirmada] = useState(false);
  const [senha, setSenha] = useState("");
  const [temSuporteAPasskey] = useState(suportaPasskey);
  const [cadastro, setCadastro] = useState<{ fatorId: string; qrCode: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  /**
   * Gerar o QR e uma **acao**, e nao um efeito.
   *
   * A versao anterior sincronizava por `useEffect` com `ocupado` na lista de
   * dependencias — e chamava `setOcupado(true)` logo na primeira linha. O React
   * via a dependencia mudar, rodava a limpeza, e a limpeza marcava `cancelado`
   * na requisicao que tinha acabado de comecar. O QR chegava e era descartado;
   * a tela ficava em "Gerando o codigo..." para sempre.
   *
   * Sem efeito, o problema deixa de existir: quem dispara e o clique, e o
   * resultado e usado no mesmo fluxo que o pediu.
   */
  const gerarQrCode = async () => {
    try {
      setCadastro(await iniciarCadastro());
    } catch (e) {
      setFalha((e as { message?: string })?.message ?? "Não foi possível iniciar o cadastro.");
      // Volta ao passo da senha: sem QR nao ha o que fazer na tela seguinte.
      setSenhaConfirmada(false);
    }
  };

  /**
   * Cancelar o prompt do navegador rejeita a promessa — e isso nao e falha, e a
   * pessoa mudando de ideia. Mostrar "erro" ali assustaria sem motivo.
   */
  const usarPasskey = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setFalha(null);
    try {
      await acao();
      onConcluido?.();
    } catch (e) {
      const nome = (e as { name?: string })?.name;
      if (nome === "NotAllowedError" || nome === "AbortError") return;
      setFalha((e as { message?: string })?.message ?? "Não foi possível usar a chave.");
    } finally {
      setOcupado(false);
    }
  };

  const confirmarSenha = async () => {
    setOcupado(true);
    setFalha(null);
    try {
      await reautenticar(senha);
      setSenhaConfirmada(true);
      setSenha("");
      // O QR vem na sequencia da mesma acao — ver `gerarQrCode`.
      await gerarQrCode();
    } catch (e) {
      setFalha((e as { message?: string })?.message ?? "Senha incorreta.");
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
      onConcluido?.();
    } catch (e) {
      setFalha((e as { message?: string })?.message ?? "Código inválido.");
      setCodigo("");
    } finally {
      setOcupado(false);
    }
  };

  const aviso = falha ? (
    <p className={cn(TEXT.caption, "mt-3 text-destructive")} role="alert">
      {falha}
    </p>
  ) : null;

  if (!senhaConfirmada) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cadastro-mfa-senha" className={cn(TEXT.compact, "font-medium")}>
            Confirme sua senha atual
          </Label>
          <Input
            id="cadastro-mfa-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && senha) void confirmarSenha();
            }}
            autoComplete="current-password"
            disabled={ocupado}
            autoFocus
          />
          <p className={cn(TEXT.caption, "text-muted-foreground")}>
            Uma sessão aberta não basta para vincular um novo autenticador à sua conta.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 w-full rounded-full"
          disabled={!senha || ocupado}
          onClick={() => void confirmarSenha()}
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
        </Button>
        {aviso}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className={cn(TEXT.caption, "list-decimal space-y-1 pl-4 text-muted-foreground")}>
        <li>Abra o Google Authenticator, Authy ou 1Password.</li>
        <li>Escaneie o código abaixo.</li>
        <li>Digite os 6 dígitos que o aplicativo mostrar.</li>
      </ol>

      {cadastro ? (
        <>
          <div className="flex justify-center rounded-xl bg-white p-4 ring-1 ring-black/5">
            {/* O Supabase devolve o QR pronto como SVG em data: URI — nao ha
                biblioteca de QR no bundle nem segredo indo para terceiro. */}
            <img src={cadastro.qrCode} alt="QR Code para o aplicativo autenticador" className="h-44 w-44" />
          </div>
          <details className="rounded-lg bg-muted/40 px-3 py-2">
            <summary className={cn(TEXT.caption, "cursor-pointer text-muted-foreground")}>
              Não consegue escanear?
            </summary>
            <p className={cn(TEXT.caption, "mt-2 break-all font-mono text-foreground")}>{cadastro.segredo}</p>
          </details>

          <div className="space-y-2">
            <Label htmlFor="cadastro-mfa-codigo" className={cn(TEXT.compact, "font-medium")}>
              Código de 6 dígitos
            </Label>
            <Input
              id="cadastro-mfa-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, TAMANHO_DO_CODIGO))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && codigo.length === TAMANHO_DO_CODIGO) void enviar(cadastro.fatorId);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-12 text-center text-xl tracking-[0.4em] tabular-nums"
              disabled={ocupado}
              autoFocus
            />
          </div>

          <Button
            type="button"
            className="h-11 w-full rounded-full"
            disabled={codigo.length !== TAMANHO_DO_CODIGO || ocupado}
            onClick={() => void enviar(cadastro.fatorId)}
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
          </Button>

          {/* A §11 exige que uma opcao resistente a phishing esteja
              **disponivel**, nao que seja a unica. Codigo de aplicativo pode ser
              digitado num site falso; passkey nao — so funciona no dominio em
              que foi criada.

              Hoje isto **nao aparece**: `suportaPasskey` e falso porque o
              Supabase recusa ligar WebAuthn no projeto (422, ver o comentario em
              `useMfa.ts`). Ou seja, a §11 esta descoberta e o TOTP e o unico
              fator. O bloco fica no lugar para voltar sozinho quando o recurso
              for liberado e `VITE_PASSKEY_HABILITADO` subir. */}
          {temSuporteAPasskey ? (
            <div className="border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 rounded-full"
                disabled={ocupado}
                onClick={() => void usarPasskey(() => cadastrarPasskey())}
              >
                <Fingerprint className="h-4 w-4" />
                Usar biometria ou chave de segurança
              </Button>
              <p className={cn(TEXT.caption, "mt-2 text-center text-muted-foreground")}>
                Mais seguro: só funciona neste site, então não há código para alguém pedir por telefone.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className={TEXT.compact}>Gerando o código…</p>
        </div>
      )}

      {aviso}
    </div>
  );
}
