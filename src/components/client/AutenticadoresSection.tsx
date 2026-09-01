import { useState } from "react";
import { KeyRound, Loader2, Shield, ShieldAlert, ShieldPlus, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useMfa, type Fator } from "@/hooks/useMfa";
import { CadastroDeFator } from "@/components/auth/CadastroDeFator";
import { motivoParaNaoRemoverFator } from "@/lib/mfa";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { MODAL_TELA_CHEIA } from "@/lib/modais";

/**
 * Os autenticadores da conta: o que existe, e como tirar.
 *
 * A §12 do padrão de autenticação pede que a pessoa **veja e remova** os
 * próprios autenticadores. Até aqui o projeto sabia cadastrar e não sabia
 * mostrar — o que significa que um fator cadastrado por outra pessoa, numa
 * sessão deixada aberta, ficaria invisível para sempre. Listar é o que
 * transforma o MFA em algo auditável pelo dono da conta.
 *
 * A decisão de **poder** remover fica em `motivoParaNaoRemoverFator`, no módulo
 * puro. Aqui a tela só a consulta para desabilitar o botão antes do clique; o
 * hook a refaz contra o servidor na hora de agir, porque entre abrir a página e
 * clicar o estado pode ter mudado em outra aba.
 */

const ROTULOS: Record<Fator["tipo"], { nome: string; icone: typeof Smartphone }> = {
  totp: { nome: "Aplicativo autenticador", icone: Smartphone },
  webauthn: { nome: "Chave de acesso (passkey)", icone: KeyRound },
};

/**
 * Data em texto curto. Devolve null quando a data não veio ou não dá para
 * interpretar — a linha some, em vez de mostrar "Invalid Date".
 */
function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * O cartao herda o estilo de quem hospeda.
 *
 * Esta secao aparece em dois lugares com linguagens visuais diferentes: a conta
 * do cliente (`rounded-xl` + `ring`) e o painel de admin (`rounded-[1.5rem]` +
 * `border` e sombra maior). Fixar um estilo so fazia ela destoar num dos dois —
 * e foi o que aconteceu ao leva-la para o painel.
 *
 * O padrao e o do cliente, que e onde ela nasceu; o painel passa o dele por
 * `className`. `cn` usa `tailwind-merge`, entao a classe de fora vence a de
 * dentro em vez de as duas irem para o HTML brigando.
 */
export function AutenticadoresSection({ className }: { className?: string } = {}) {
  const { isAdmin } = useAuth();
  const { carregando, fatores, erro, removerFator, recarregar } = useMfa(isAdmin);

  const [alvo, setAlvo] = useState<Fator | null>(null);
  const [codigo, setCodigo] = useState("");
  const [removendo, setRemovendo] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);

  const fechar = () => {
    if (removendo) return;
    setAlvo(null);
    setCodigo("");
  };

  const confirmar = async () => {
    if (!alvo || (alvo.status === "verified" && codigo.length !== 6)) return;
    setRemovendo(true);
    try {
      await removerFator(alvo.id, codigo);
      toast.success("Autenticador removido.");
      setAlvo(null);
      setCodigo("");
    } catch (e) {
      // A mensagem do impedimento é escrita para ser lida por quem clicou —
      // repassar é melhor que trocar por um texto genérico.
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <section className={cn("overflow-hidden rounded-[1.25rem] bg-background/95 shadow-sm border border-border/70", className)}>
      <div className="p-5 sm:p-6">
        <h2 className={cn(TEXT.body, "flex items-center gap-2 font-semibold text-foreground")}>
          {/* `h-5 w-5 text-primary`: e a forma dos cabecalhos de cartao no resto
              do projeto, tanto na conta quanto no painel. Estava `h-4` e cinza,
              e por isso o cartao parecia de outra tela. */}
          <Shield className="h-5 w-5 text-primary" />
          Verificação em duas etapas
        </h2>
        <p className={cn(TEXT.caption, "mt-1 max-w-prose leading-6 text-muted-foreground")}>
          Estes são os dispositivos que podem confirmar sua identidade. Se algum aqui não for seu,
          remova e troque sua senha.
        </p>

        <div className="mt-4">
          {carregando ? (
            <p className={cn(TEXT.caption, "flex items-center gap-2 text-muted-foreground")}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando…
            </p>
          ) : erro ? (
            /* Falha de leitura não pode virar "você não tem nenhum": a pessoa
               concluiria que foi removido e trocaria a senha à toa. */
            <p className={cn(TEXT.caption, "flex items-center gap-2 text-amber-700")}>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {erro}
            </p>
          ) : fatores.length === 0 ? (
            <p className={cn(TEXT.caption, "rounded-lg bg-muted/40 px-3 py-2.5 text-muted-foreground")}>
              Nenhum autenticador cadastrado nesta conta.
            </p>
          ) : (
            <ul className="space-y-2">
              {fatores.map((fator) => {
                const { nome, icone: Icone } = ROTULOS[fator.tipo];
                const criadoEm = dataCurta(fator.criadoEm);
                const usadoEm = dataCurta(fator.usadoEm);
                const impedimento = motivoParaNaoRemoverFator({
                  fatores,
                  fatorId: fator.id,
                  exigeMfa: isAdmin,
                });

                return (
                  <li
                    key={fator.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5"
                  >
                    <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className={cn(TEXT.compact, "truncate font-medium text-foreground")}>
                        {fator.amigavel || nome}
                      </p>
                      <p className={cn(TEXT.caption, "text-muted-foreground")}>
                        {/* A §12 pede que a gestão mostre a criação: diante de um
                            autenticador que a pessoa não reconhece, "apareceu
                            quando?" é a pergunta que decide se houve invasão. */}
                        {[
                          fator.amigavel ? nome : null,
                          fator.status === "unverified" ? "cadastro não concluído" : null,
                          criadoEm ? `cadastrado em ${criadoEm}` : null,
                          // Ausência de data não vira "nunca usado": a trilha pode
                          // não ter respondido, e afirmar o que não se sabe aqui
                          // levaria alguém a concluir que o fator é de outra pessoa.
                          usadoEm ? `último uso em ${usadoEm}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 px-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      disabled={Boolean(impedimento)}
                      title={impedimento ?? "Remover este autenticador"}
                      onClick={() => setAlvo(fator)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* O cadastro precisa morar aqui.
            Enquanto o MFA era obrigatorio, ele so existia dentro do portao do
            painel — que aparecia sozinho no primeiro acesso. Com o MFA
            opcional, o portao nao bloqueia mais, e sem este botao nao haveria
            como ativar a protecao por vontade propria. */}
        {!carregando && !erro ? (
          <Button
            type="button"
            variant={fatores.length === 0 ? "default" : "outline"}
            size="sm"
            className="mt-4 h-9 gap-1.5 rounded-full"
            onClick={() => setCadastrando(true)}
          >
            <ShieldPlus className="h-4 w-4" />
            {fatores.length === 0 ? "Ativar verificação em duas etapas" : "Adicionar outro autenticador"}
          </Button>
        ) : null}
      </div>

      <Dialog open={cadastrando} onOpenChange={(v) => setCadastrando(v)}>
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.35rem] border-border/70 sm:max-w-md sm:rounded-[1.5rem]")}>
          <DialogHeader>
            <DialogTitle className="text-left">Verificação em duas etapas</DialogTitle>
            {/* Dizia "— ou sua biometria" ate 08/08. A biometria saiu da tela
                porque o Supabase nao deixa ligar WebAuthn (ver `suportaPasskey`
                em `useMfa.ts`), e o texto ficou prometendo o que a tela abaixo
                nao oferece mais. */}
            <DialogDescription className="text-left">
              Além da senha, o acesso passa a pedir um código do seu aplicativo autenticador.
            </DialogDescription>
          </DialogHeader>

          <CadastroDeFator
            isAdmin={isAdmin}
            onConcluido={() => {
              setCadastrando(false);
              void recarregar();
              toast.success("Autenticador ativado.");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(alvo)} onOpenChange={(v) => (v ? null : fechar())}>
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.35rem] border-border/70 sm:max-w-md sm:rounded-[1.5rem]")}>
          <DialogHeader>
            <DialogTitle className="text-left">Remover este autenticador?</DialogTitle>
            <DialogDescription className="text-left">
              Ele deixa de servir para confirmar sua identidade. Você pode cadastrar outro depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="mfa-codigo-remover" className={cn(TEXT.compact, "font-medium")}>
              Código do aplicativo autenticador
            </Label>
            <Input
              id="mfa-codigo-remover"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && codigo.length === 6) void confirmar();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-12 text-center text-xl tracking-[0.4em] tabular-nums"
              disabled={removendo}
              autoFocus
            />
            {/* §12: uma sessão antiga, sozinha, não desmonta a proteção da conta.

                Pedimos o código, e não a senha, por dois motivos. O primeiro é
                que o Supabase exige `aal2` para remover fator verificado, e só o
                código sobe a sessão até lá — conferir a senha abria sessão nova
                em `aal1` e derrubava justamente a permissão de remover. O
                segundo é que o código prova posse do autenticador, que é prova
                mais forte do que a senha para desligar a proteção. */}
            <p className={cn(TEXT.caption, "text-muted-foreground")}>
              Abra o aplicativo e digite os 6 dígitos. Pedimos o código para que uma sessão
              esquecida aberta não sirva para desligar sua proteção.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fechar} disabled={removendo}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={(alvo?.status === "verified" && codigo.length !== 6) || removendo}
              onClick={() => void confirmar()}
            >
              {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {removendo ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
