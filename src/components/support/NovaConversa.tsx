import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDocumentId } from "@/lib/brazilianIds";
import { SUPPORT_CONVERSATIONS_TABLE, SUPPORT_MESSAGES_TABLE } from "@/lib/supportChat";
import { cn } from "@/lib/utils";

type ClientePossivel = {
  user_id: string;
  name: string | null;
  company: string | null;
  cnpj: string | null;
  phone: string | null;
};

/**
 * A equipe começar a conversa.
 *
 * ## Por que existe
 *
 * A conversa só nascia de um lado: o cliente abria a seção Mensagens e ela
 * aparecia. Não havia como puxar assunto — avisar que um pedido travou, cobrar
 * cadastro incompleto, deixar por escrito o que foi combinado no telefone. Isso
 * acabava indo pelo WhatsApp pessoal de quem atende, fora da plataforma, onde o
 * resto da equipe não vê e nada fica registrado.
 *
 * ## ⚠️ Reaproveita a conversa que já existe
 *
 * Um cliente tem **uma** conversa com a equipe, não uma por assunto — é assim
 * que a tela do cliente foi feita (`useCustomerSupportConversation` busca uma
 * só). Criar outra deixaria o cliente vendo só uma das duas, e a equipe
 * respondendo na que ele não está lendo.
 *
 * O cliente é avisado por um gatilho no banco, e só quando a mensagem é a
 * primeira da conversa — ver a migration 20260831192000.
 */
export function NovaConversa({ onAbrirConversa }: { onAbrirConversa: (conversaId: string) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ClientePossivel | null>(null);
  const [texto, setTexto] = useState("");

  const { data: clientes = [], isLoading } = useQuery<ClientePossivel[]>({
    queryKey: ["clientes-para-conversa"],
    // Só busca quando o diálogo abre: é uma lista de cadastro inteira, e ela
    // não tem por que viajar enquanto ninguém pediu.
    enabled: aberto,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic+b2b_customer_profiles")
        .select("user_id, name, company, cnpj, phone")
        .order("name");

      if (error) throw error;
      return (data ?? []) as ClientePossivel[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? clientes.filter((cliente) =>
          [cliente.name, cliente.company, cliente.cnpj].some((campo) => (campo ?? "").toLowerCase().includes(termo)),
        )
      : clientes;
    // 40 linhas bastam para escolher: a lista inteira dentro de um diálogo vira
    // rolagem infinita, e quem procura alguém específico digita o nome.
    return base.slice(0, 40);
  }, [busca, clientes]);

  const abrir = useMutation({
    mutationFn: async () => {
      if (!escolhido || !user?.id) throw new Error("Escolha um cliente.");
      const corpo = texto.trim();
      if (!corpo) throw new Error("Escreva a primeira mensagem.");

      // A conversa que já existe vem primeiro. Ver a nota do componente: duas
      // conversas para o mesmo cliente deixariam ele lendo só uma delas.
      const existente = await supabase
        .from(SUPPORT_CONVERSATIONS_TABLE)
        .select("id")
        .eq("customer_user_id", escolhido.user_id)
        .maybeSingle();

      if (existente.error) throw existente.error;

      let conversaId = existente.data?.id as string | undefined;

      if (!conversaId) {
        const criada = await supabase
          .from(SUPPORT_CONVERSATIONS_TABLE)
          .insert({
            customer_user_id: escolhido.user_id,
            customer_name: escolhido.name,
            customer_company: escolhido.company,
            customer_cnpj: escolhido.cnpj,
            customer_phone: escolhido.phone,
            status: "open",
          })
          .select("id")
          .single();

        if (criada.error) throw criada.error;
        conversaId = criada.data.id as string;
      }

      const mensagem = await supabase.from(SUPPORT_MESSAGES_TABLE).insert({
        conversation_id: conversaId,
        sender_user_id: user.id,
        sender_role: "admin",
        body: corpo,
      });

      if (mensagem.error) throw mensagem.error;
      return conversaId;
    },
    onSuccess: async (conversaId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["support-esperando"] }),
      ]);
      toast.success("Conversa aberta", { description: "O cliente foi avisado na plataforma." });
      setAberto(false);
      setBusca("");
      setEscolhido(null);
      setTexto("");
      onAbrirConversa(conversaId);
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível abrir a conversa."),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Nova conversa"
          title="Começar uma conversa com um cliente"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Para falar com um cliente que ainda não escreveu. Ele recebe um aviso na plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="nc-cliente">Cliente</Label>

            {escolhido ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{escolhido.name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {escolhido.company || "—"}
                    {escolhido.cnpj ? ` · ${formatDocumentId(escolhido.cnpj)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEscolhido(null)}
                  className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    id="nc-cliente"
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Nome, empresa ou CNPJ"
                    className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" /> : null}
                </div>

                <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {filtrados.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {isLoading ? "Carregando..." : "Nenhum cliente encontrado."}
                    </li>
                  ) : (
                    filtrados.map((cliente) => (
                      <li key={cliente.user_id}>
                        <button
                          type="button"
                          onClick={() => setEscolhido(cliente)}
                          className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/60"
                        >
                          <p className="truncate text-sm text-foreground">{cliente.name || "Sem nome"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cliente.company || "—"}
                            {cliente.cnpj ? ` · ${formatDocumentId(cliente.cnpj)}` : ""}
                          </p>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-mensagem">Primeira mensagem</Label>
            <textarea
              id="nc-mensagem"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={4}
              placeholder="Olá! Aqui é da equipe Clinic+…"
              className={cn(
                "w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => abrir.mutate()}
            disabled={!escolhido || !texto.trim() || abrir.isPending}
          >
            {abrir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enviar e abrir conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
