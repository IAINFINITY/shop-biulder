import { useState } from "react";
import { toast } from "sonner";
import { BellOff, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { definirAceiteDeCampanhas } from "@/lib/customerProfile";
import { cn } from "@/lib/utils";

/**
 * Ligar e desligar as campanhas.
 *
 * ## Por que existe
 *
 * As notificações de campanha são marketing, e a base legal escolhida foi
 * legítimo interesse (art. 7º, IX da LGPD). Essa base só se sustenta quando dá
 * para recusar — o art. 10, § 2º exige transparência reforçada, e recusar é a
 * forma prática dela. Antes disto não havia opt-out em lugar nenhum.
 *
 * ## O que este botão NÃO desliga
 *
 * Aviso endereçado à pessoa continua chegando. A separação está na policy do
 * banco, pelo `target_user_id`: campanha é a notificação sem destinatário.
 * Quem recusa propaganda não está recusando aviso sobre o próprio pedido, e
 * misturar as duas seria pior para o cliente do que para nós.
 *
 * ## Estado otimista, com volta
 *
 * O switch muda na hora e volta se a gravação falhar. Esperar a resposta deixaria
 * o controle travado por um instante, e é o tipo de latência que faz a pessoa
 * clicar de novo achando que não pegou.
 */
export function PreferenciaDeCampanhas({ className }: { className?: string }) {
  const { user, customerProfile, refreshCustomerProfile } = useAuth();

  // Ausente conta como aceito: a base é legítimo interesse, então o tratamento
  // começa lícito e a pessoa interrompe se quiser.
  const salvo = customerProfile?.aceita_campanhas !== false;
  const [aceita, setAceita] = useState(salvo);
  const [salvando, setSalvando] = useState(false);

  // O perfil pode chegar depois da primeira renderização.
  if (aceita !== salvo && !salvando) setAceita(salvo);

  const alternar = async (proximo: boolean) => {
    const anterior = aceita;
    setAceita(proximo);
    setSalvando(true);

    try {
      await definirAceiteDeCampanhas(proximo);
      if (user?.id) await refreshCustomerProfile?.(user.id);
      toast.success(proximo ? "Você voltará a receber campanhas." : "Você não receberá mais campanhas.");
    } catch (erro) {
      setAceita(anterior);
      toast.error((erro as Error)?.message ?? "Não foi possível salvar a preferência.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl bg-background/95 p-4 ring-1 ring-black/5 shadow-sm sm:items-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          aceita ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {aceita ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <Label htmlFor="aceita-campanhas" className="text-sm font-medium text-foreground">
          Receber campanhas e novidades
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Desligando, você deixa de ver campanhas do catálogo. Avisos sobre os seus pedidos continuam chegando.
        </p>
      </div>

      <Switch
        id="aceita-campanhas"
        checked={aceita}
        disabled={salvando || !customerProfile}
        onCheckedChange={(valor) => void alternar(valor)}
        aria-label="Receber campanhas e novidades"
      />
    </div>
  );
}
