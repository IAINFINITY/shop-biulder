import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AvisoDoPainel, PreferenciasDeAviso } from "@/lib/avisosDoPainel";

const EVENTOS = "clinic+b2b_admin_events";
const LEITURAS = "clinic+b2b_admin_event_reads";
const PREFERENCIAS = "clinic+b2b_admin_notification_prefs";

/** Quantos avisos o sino carrega. Além disso vira histórico, não aviso. */
const LIMITE = 50;

/**
 * Os avisos do painel, já com "eu li isto" resolvido.
 *
 * ## Duas consultas, e não um join
 *
 * O PostgREST faria o join se houvesse foreign key entre evento e leitura na
 * direção certa — mas a leitura é **por pessoa**, e um join embutido traria as
 * leituras dos outros administradores junto. Buscar as minhas e cruzar aqui é
 * mais simples de ler e não vaza o que o colega já viu.
 */
export function useAvisosDoPainel(userId: string | null, enabled = true) {
  return useQuery<AvisoDoPainel[]>({
    queryKey: ["avisos-do-painel", userId],
    enabled: enabled && Boolean(userId),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    // 60s: o sino fica na topbar de todas as telas, e um aviso é algo que se
    // descobre "em algum momento", não em tempo real. A caixa de mensagens é
    // que precisa ser rápida.
    refetchInterval: enabled ? 60_000 : false,
    queryFn: async () => {
      const [eventos, leituras] = await Promise.all([
        supabase.from(EVENTOS).select("*").order("created_at", { ascending: false }).limit(LIMITE),
        supabase
          .from(LEITURAS)
          .select("event_id, lida_em, dispensado_em")
          .eq("admin_user_id", userId as string),
      ]);

      if (eventos.error) throw eventos.error;
      if (leituras.error) throw leituras.error;

      const lidas = new Map(
        (leituras.data ?? []).map((linha) => [linha.event_id as string, linha.lida_em as string | null]),
      );
      const dispensadas = new Set(
        (leituras.data ?? [])
          .filter((linha) => linha.dispensado_em)
          .map((linha) => linha.event_id as string),
      );

      return (eventos.data ?? [])
        // ⚠️ O corte é aqui, e não numa consulta com `not.in`: a lista de
        // dispensados cresce sem teto e viraria uma URL de milhares de ids.
        // Cinquenta eventos filtrados na memória custam nada.
        .filter((linha) => !dispensadas.has((linha as { id: string }).id))
        .map((linha) => ({
          ...(linha as unknown as AvisoDoPainel),
          lida_em: lidas.get((linha as { id: string }).id) ?? null,
        }));
    },
  });
}

/** As preferências desta pessoa. Só vêm as que ela mudou — ver `avisoEstaLigado`. */
export function usePreferenciasDeAviso(userId: string | null, enabled = true) {
  return useQuery<PreferenciasDeAviso>({
    queryKey: ["preferencias-de-aviso", userId],
    enabled: enabled && Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PREFERENCIAS)
        .select("tipo, ativo")
        .eq("admin_user_id", userId as string);

      if (error) throw error;

      const preferencias: PreferenciasDeAviso = {};
      for (const linha of data ?? []) preferencias[linha.tipo as string] = Boolean(linha.ativo);
      return preferencias;
    },
  });
}

export function useSalvarPreferenciaDeAviso(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { tipo: string; ativo: boolean }) => {
      if (!userId) throw new Error("Sem usuário para salvar a preferência.");

      // `upsert` porque a linha pode não existir: quem nunca mexeu no aviso não
      // tem registro nenhum, e essa ausência é o "ligado" padrão.
      const { error } = await supabase
        .from(PREFERENCIAS)
        .upsert(
          { admin_user_id: userId, tipo: params.tipo, ativo: params.ativo, updated_at: new Date().toISOString() },
          { onConflict: "admin_user_id,tipo" },
        );

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["preferencias-de-aviso", userId] }),
        // A lista do sino muda junto: desligar um tipo tem que sumir com os
        // avisos dele na hora, e não no próximo ciclo de 60s.
        queryClient.invalidateQueries({ queryKey: ["avisos-do-painel", userId] }),
      ]);
    },
  });
}

/**
 * Marcar como lido.
 *
 * Sem `ids`, marca tudo o que está na tela — é o "marcar todas como lidas".
 * Quem decide o que é "tudo" é quem chama, e não esta função: o sino já filtrou
 * por permissão e preferência, e marcar como lido um aviso que a pessoa nem
 * pode ver seria gravar uma leitura que nunca aconteceu.
 */
export function useMarcarAvisosComoLidos(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!userId || ids.length === 0) return;

      const { error } = await supabase.from(LEITURAS).upsert(
        ids.map((id) => ({ admin_user_id: userId, event_id: id, lida_em: new Date().toISOString() })),
        { onConflict: "admin_user_id,event_id" },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["avisos-do-painel", userId] });
    },
  });
}

/**
 * Limpar a lista: tirar os avisos da caixa desta pessoa.
 *
 * ## Não apaga o aviso
 *
 * `clinic+b2b_admin_events` é compartilhada entre todos os administradores.
 * Apagar a linha limparia a caixa da equipe inteira — o `dispensado_em` é por
 * pessoa, e é isso que a migration `20260901180000` explica.
 *
 * ## Limpar também marca como lido
 *
 * Quem tira da lista um aviso não lido não pretende continuar com o contador
 * aceso por causa de algo que não está mais em lugar nenhum. As duas colunas vão
 * juntas nesta ação; "marcar todos" continua mexendo só em `lida_em`.
 */
export function useLimparAvisosDoPainel(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!userId || ids.length === 0) return;

      const agora = new Date().toISOString();
      const { error } = await supabase.from(LEITURAS).upsert(
        ids.map((id) => ({
          admin_user_id: userId,
          event_id: id,
          lida_em: agora,
          dispensado_em: agora,
        })),
        { onConflict: "admin_user_id,event_id" },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["avisos-do-painel", userId] });
    },
  });
}
