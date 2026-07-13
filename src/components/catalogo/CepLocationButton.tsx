import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { onlyDigits } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import { MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AddressFormData } from "@/lib/address";

type CepStatus = "idle" | "loading" | "found" | "not_found" | "error";

type CepData = {
  cep: string;
  city: string;
  state: string;
};

export function CepLocationButton({
  currentCep,
  onCepResolved,
}: {
  currentCep: CepData | null;
  onCepResolved: (data: CepData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<CepStatus>("idle");

  const digits = onlyDigits(input);

  const resolveCep = useCallback(async (cepDigits: string) => {
    setStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();
      if (data.erro) { setStatus("not_found"); return; }
      setStatus("found");
      const resolved: CepData = {
        cep: formatCep(cepDigits),
        city: data.localidade?.trim() || "",
        state: data.uf?.trim() || "",
      };
      onCepResolved(resolved);
    } catch {
      setStatus("error");
    }
  }, [onCepResolved]);

  useEffect(() => {
    if (digits.length !== 8) { setStatus("idle"); return; }
    const timer = setTimeout(() => resolveCep(digits), 400);
    return () => clearTimeout(timer);
  }, [digits, resolveCep]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setInput(currentCep?.cep ?? "");
      setStatus("idle");
    }
  };

  const label = currentCep
    ? `${currentCep.city}, ${currentCep.state}`
    : "Atualizar CEP";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-4 py-2 text-left transition-colors hover:bg-muted/60",
            currentCep ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <MapPin className={cn(
            "h-5 w-5 shrink-0",
            currentCep ? "text-primary" : "text-muted-foreground",
          )} />
          <span className="leading-tight">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground/80">
              Informações do CEP
            </span>
            <span className="block text-sm font-semibold">
              {label}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-72 rounded-xl border-border/60 p-4 shadow-lg"
      >
        <p className="text-sm font-semibold text-foreground">
          {currentCep ? "Alterar CEP de entrega" : "Informe seu CEP"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Consulte prazos de entrega e disponibilidade.
        </p>

        <div className="mt-4 space-y-3">
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              maxLength={9}
              value={input}
              onChange={(e) => {
                const cleaned = onlyDigits(e.target.value).slice(0, 8);
                setInput(formatCep(cleaned));
              }}
              className={cn(
                "h-11 rounded-xl border-border/70 bg-background pl-4 pr-10 text-sm tracking-[0.1em] transition-all",
                status === "found" && "border-emerald-400/60 ring-1 ring-emerald-400/20",
                status === "error" && "border-destructive/60 ring-1 ring-destructive/20",
              )}
              aria-label="CEP"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : status === "found" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : status === "error" || status === "not_found" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : null}
            </span>
          </div>

          {status === "found" && currentCep ? (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
              <p className="font-medium">CEP confirmado</p>
              <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                {currentCep.city}, {currentCep.state} — {currentCep.cep}
              </p>
            </div>
          ) : status === "not_found" ? (
            <p className="text-xs text-destructive">CEP não encontrado. Verifique o número.</p>
          ) : status === "error" ? (
            <p className="text-xs text-destructive">Erro ao consultar. Tente novamente.</p>
          ) : null}

          <Button
            type="button"
            size="sm"
            className="w-full rounded-xl text-xs font-semibold"
            onClick={() => setOpen(false)}
          >
            {currentCep ? "Confirmar" : "Buscar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
