import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatMoney";
import { customerTypeLabel, normalizeCustomerType } from "@/lib/pricing";
import { formatDocumentId, formatPhone } from "@/lib/brazilianIds";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { lerChaveDeTabela } from "@/lib/tabelasDePreco";
import { rotuloDaTabela, tabelasOferecidas, useTabelasDePreco } from "@/hooks/useTabelasDePreco";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_ADDRESSES_TABLE, customerAddressFromRow, type CustomerAddress } from "@/lib/customerAddresses";
import { CUSTOMER_PROFILES_TABLE, registrarAcessoAdminAoCadastro } from "@/lib/customerProfile";
import { NomeDaEmpresa } from "@/components/shared/NomeDaEmpresa";
import { CadastrosPendentesSection } from "@/components/admin/CadastrosPendentesSection";
import { useCadastrosPendentes } from "@/hooks/useCadastrosPendentes";
import { AdminTabelaDePessoas, CelulaDePessoa } from "@/components/admin/AdminTabelaDePessoas";
import { AdminPaginacao } from "@/components/admin/AdminPaginacao";
import { paginar } from "@/lib/paginacao";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AdminListaPadrao } from "./AdminListaPadrao";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { DialogoDeResetDeSenha, type AlvoDoReset } from "./DialogoDeResetDeSenha";
import type { AdminCustomerSummary } from "./adminTypes";
import type { CustomerProfile } from "@/lib/customerProfile";
import { deleteCustomerRecord } from "@/lib/customerProfile";
import { listAdminUsers, getRoleLabel, type AdminUserRecord } from "@/lib/adminUsers";
import { MODAL_TELA_CHEIA, MODAL_TELA_CHEIA_CORPO } from "@/lib/modais";
import { cn } from "@/lib/utils";

type AdminClientsSectionProps = {
  customerProfiles: CustomerProfile[];
  customerSummaries: AdminCustomerSummary[];
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientFilter: "all" | "orders" | "revenue";
  onClientFilterChange: (value: "all" | "orders" | "revenue") => void;
  /**
   * Tabela de preço em foco, no formato de `tabelasDePreco` (`tipo:funcionario`,
   * `negociada:8728`). Controlado de fora porque a seção de Preços manda para cá:
   * "97 contas compram por esta tabela" vira um link, e não uma lista repetida
   * dentro do editor de preço.
   */
  filtroDeTabela: string | null;
  /** Abre a seção Preços — é lá que tipos e tabelas são criados e apagados. */
  onIrParaPrecos: () => void;
  onFiltroDeTabelaChange: (valor: string | null) => void;
  onUpdateCustomerType: (payload: {
    userId: string | null;
    cnpj: string;
    customerType: string;
  }) => Promise<Error | null>;
};

function getCustomerKey(customer: AdminCustomerSummary) {
  return customer.userId ?? customer.cnpj ?? customer.name;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function DetailField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full min-h-[64px] sm:min-h-[80px] flex-col justify-between rounded-[1.2rem] border border-border/70 bg-muted/20 p-3 sm:p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
        {/* `break-words`: este campo mostra e-mail e documento — cadeias sem
            espaco, que o navegador nao quebra sozinho e passavam por fora do
            cartao no celular. */}
        <p className="break-words text-[0.8125rem] sm:text-sm font-medium leading-5 sm:leading-6 text-foreground">
          {value}
        </p>
        {hint ? <p className="text-[0.6875rem] leading-4 sm:leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Uma aba de tipo de conta, com quantos há dentro.
 *
 * ⚠️ **Zero aparece.** Ao contrário das abas da caixa de mensagens — onde o
 * zero era ruído porque as abas eram estados que iam e vinham — aqui elas são
 * os tipos de conta cadastrados, e "Distribuidor: 0" é uma resposta: o tipo
 * existe e ninguém o usa. Some-lo esconderia um tipo que alguém criou.
 */
function AbaDeTipo({
  ativo,
  onClick,
  total,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={ativo ? "default" : "outline"}
      className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
      onClick={onClick}
    >
      {children}
      <span
        className={cn(
          "ml-1.5 rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums",
          ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
        )}
      >
        {total}
      </span>
    </Button>
  );
}

export function AdminClientsSection({
  customerProfiles,
  customerSummaries,
  clientSearch,
  onClientSearchChange,
  clientFilter,
  filtroDeTabela,
  onIrParaPrecos,
  onFiltroDeTabelaChange,
  onClientFilterChange,
  onUpdateCustomerType,
}: AdminClientsSectionProps) {
  const NO_REPRESENTATIVE_VALUE = "__none__";
  // `addCustomType` saiu daqui junto com o modal: criar tipo agora é em Preços.
  const { options: customerTypes } = useCustomerTypes();

  /**
   * `funcionario` volta a aparecer aqui — e agora faz sentido.
   *
   * Antes esta tela escondia o tipo porque `clientProfiles` filtrava funcionário
   * fora antes de chegar: o balde mostraria zero para sempre, e reclassificar
   * alguém como funcionário faria a pessoa sumir no refresh seguinte.
   *
   * O que mudou foi a premissa. Esta tela passou a ser o **diretório de quem
   * compra** — cliente e funcionário —, então o tipo tem conteúdo e ninguém
   * some ao ser reclassificado.
   *
   * A aba Funcionários continua existindo e continua sendo onde funcionário
   * nasce: é lá que se cria, edita e reseta senha. É a separação que os
   * catálogos B2B maiores usam — diretórios distintos para operação, um lugar só
   * para consultar.
   */
  const clientCustomerTypes = customerTypes;
  const queryClient = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<AdminCustomerSummary | null>(null);
  const [updatingCustomerKey, setUpdatingCustomerKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<AdminCustomerSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editObservation, setEditObservation] = useState("");
  const [editType, setEditType] = useState("cliente");
  /**
   * A tabela negociada desta conta. `"geral"` = nenhuma, paga pela tabela do tipo.
   *
   * ⚠️ **Este campo não existia na tela.** As 38 contas que hoje têm tabela
   * negociada foram gravadas por SQL direto — não havia como associar uma conta
   * a uma tabela pelo painel, embora a seção Preços dissesse "para trocar, use a
   * seção Preços". Era uma instrução para uma porta que não existia.
   */
  const [editTabela, setEditTabela] = useState<string>("geral");

  const { data: tabelasDePreco = [] } = useTabelasDePreco();
  const [editSaving, setEditSaving] = useState(false);
  const canDeleteCustomer = Boolean(editCustomer?.userId || editCustomer?.cnpj);
  /**
   * Quem esta prestes a ter a senha resetada, ou `null`.
   *
   * So cliente **com conta**. O cadastro legado nao tem `user_id` — nao ha
   * credencial para resetar, e o botao apareceria prometendo o que nao existe.
   */
  const [alvoDoReset, setAlvoDoReset] = useState<AlvoDoReset | null>(null);

  const { data: adminUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    staleTime: 30_000,
    queryFn: listAdminUsers,
  });
  const [draftRepresentanteId, setDraftRepresentanteId] = useState<string>("");
  const [representanteSaving, setRepresentanteSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // A pagina volta ao inicio sempre que o recorte muda: continuar na pagina 4
  // de uma lista que agora tem duas paginas mostra o vazio de `paginar`, e
  // parece que o filtro nao achou nada.
  // ⚠️ Os cadastros pendentes viraram **aba**, e não mais uma caixa acima da
  // lista. Recolhida ela funcionava com 3; com 100 empurraria o trabalho do dia
  // inteiro para fora da tela toda vez que alguém a abrisse. Como aba ela usa a
  // mesma moldura e a mesma busca, e some da frente quando está zerada.
  const [vendoPendentes, setVendoPendentes] = useState(false);
  const { data: pendentes = [] } = useCadastrosPendentes();

  const [paginaAtual, setPaginaAtual] = useState(0);
  useEffect(() => {
    setPaginaAtual(0);
  }, [clientSearch, clientFilter, typeFilter, filtroDeTabela]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { unknown: 0 };
    for (const c of customerSummaries) {
      const t = c.customerType ?? "unknown";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [customerSummaries]);

  const customerProfilesByKey = useMemo(() => {
    const map = new Map<string, CustomerProfile>();
    for (const profile of customerProfiles) {
      const userKey = profile.user_id?.trim();
      const cnpjKey = profile.cnpj?.replace(/\D/g, "");
      if (userKey) map.set(userKey, profile);
      if (cnpjKey) map.set(cnpjKey, profile);
    }
    return map;
  }, [customerProfiles]);

  const filteredCustomers = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();

    let filtered = customerSummaries;

    if (term) {
      filtered = filtered.filter((customer) => {
        const profile = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
        const email = profile?.email ?? "";
        return [customer.name, customer.company ?? "", customer.phone ?? "", customer.cnpj ?? "", email].some((value) =>
          value.toLowerCase().includes(term),
        );
      });
    }

    if (typeFilter !== null) {
      filtered = filtered.filter((customer) => {
        if (typeFilter === "unknown") return !customer.customerType;
        return customer.customerType === typeFilter;
      });
    }

    // A tabela por onde a pessoa compra: TPR quando ela tem, senão a geral do
    // tipo. É a mesma precedência de `contarPessoasPorTabela` — contar de um
    // jeito na tela de Preços e filtrar de outro aqui faria os dois números
    // discordarem.
    const escopo = lerChaveDeTabela(filtroDeTabela);
    if (escopo) {
      filtered = filtered.filter((customer) => {
        const profile = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
        if (!profile) return false;
        const tpr = profile.proxis_tpr_id;
        if (escopo.origem === "negociada") return tpr === escopo.tprId;
        return (tpr ?? null) === null && normalizeCustomerType(profile.customer_type) === escopo.customerType;
      });
    }

    return [...filtered].sort((a, b) => {
      if (clientFilter === "orders") return b.orders - a.orders || b.total - a.total;
      if (clientFilter === "revenue") return b.total - a.total || b.orders - a.orders;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [clientFilter, clientSearch, customerProfilesByKey, customerSummaries, typeFilter, filtroDeTabela]);

  // 46 clientes hoje, e a lista nao tinha pagina nenhuma: era rolar ate achar.
  const pagina = useMemo(() => paginar(filteredCustomers, paginaAtual), [filteredCustomers, paginaAtual]);

  /** Nome legível da tabela em foco, para a faixa não mostrar `negociada:8728`. */
  const rotuloDaTabelaFiltrada = useMemo(() => {
    const escopo = lerChaveDeTabela(filtroDeTabela);
    if (!escopo) return "";
    return escopo.origem === "negociada" ? `Proxis ${escopo.tprId}` : customerTypeLabel(escopo.customerType);
  }, [filtroDeTabela]);

  const selectedDetailsProfile = useMemo(() => {
    if (!detailsCustomer) return null;
    if (detailsCustomer.userId && customerProfilesByKey.has(detailsCustomer.userId)) {
      return customerProfilesByKey.get(detailsCustomer.userId) ?? null;
    }
    const cnpjKey = detailsCustomer.cnpj?.replace(/\D/g, "");
    if (cnpjKey && customerProfilesByKey.has(cnpjKey)) {
      return customerProfilesByKey.get(cnpjKey) ?? null;
    }
    return null;
  }, [customerProfilesByKey, detailsCustomer]);

  const detailUserId = detailsCustomer?.userId ?? selectedDetailsProfile?.user_id ?? null;
  const detailCnpj = selectedDetailsProfile?.cnpj || detailsCustomer?.cnpj || "";
  const normalizedDetailCnpj = detailCnpj.replace(/\D/g, "");

  const { data: detailAddresses = [] } = useQuery({
    queryKey: ["admin-customer-addresses", detailUserId],
    enabled: detailsOpen && Boolean(detailUserId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_ADDRESSES_TABLE)
        .select("id,user_id,label,is_default,cep,street,number,complement,neighborhood,city,state,ibge,created_at,updated_at")
        .eq("user_id", detailUserId as string)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => customerAddressFromRow(row)) as CustomerAddress[];
    },
  });

  useEffect(() => {
    if (!detailsOpen) {
      setDetailsCustomer(null);
    }
  }, [detailsOpen]);

  useEffect(() => {
    if (detailsOpen && selectedDetailsProfile) {
      setDraftRepresentanteId(selectedDetailsProfile.representante_id ?? NO_REPRESENTATIVE_VALUE);
    }
  }, [detailsOpen, selectedDetailsProfile]);

  const openEdit = (customer: AdminCustomerSummary) => {
    setEditCustomer(customer);
    const profile = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
    setEditName(customer.name);
    setEditPhone(customer.phone ?? "");
    setEditEmail(profile?.email ?? "");
    setEditObservation(profile?.observation ?? "");
    setEditType(customer.customerType ?? "cliente");
    setEditTabela(
      (() => {
        const perfil = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
        const tpr = perfil?.proxis_tpr_id;
        return tpr == null ? "geral" : String(tpr);
      })(),
    );
    setEditOpen(true);
  };

  const openDetails = (customer: AdminCustomerSummary) => {
    setDetailsCustomer(customer);
    setDetailsOpen(true);
    // Trilha de acesso a dado pessoal: quem abriu a ficha de quem. Não bloqueia
    // nada e não espera resposta — ver `registrarAcessoAdminAoCadastro`.
    void registrarAcessoAdminAoCadastro(customer.userId ?? null, customer.cnpj ?? null);
  };


  const handleEditSave = async () => {
    if (!editCustomer?.userId) {
      toast.error("Este cliente não possui perfil completo para edição.");
      return;
    }
    setEditSaving(true);
    try {
      const { error: profileError } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .update({
          name: editName.trim(),
          phone: editPhone.trim(),
          observation: editObservation.trim() || null,
        })
        .eq("user_id", editCustomer.userId);
      if (profileError) throw profileError;

      const currentProfile = editCustomer.userId ? customerProfilesByKey.get(editCustomer.userId) : null;
      if (editEmail.trim() && editEmail.trim() !== currentProfile?.email) {
        const { error: emailError } = await supabase.rpc("admin_update_user_email", {
          p_user_id: editCustomer.userId,
          p_email: editEmail.trim(),
        });
        if (emailError) throw emailError;
      }

      const { error: emailColumnError } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .update({ email: editEmail.trim() || null })
        .eq("user_id", editCustomer.userId);
      if (emailColumnError) throw emailColumnError;

      // A tabela negociada é do perfil, e não do tipo: um cliente e um
      // distribuidor podem compartilhar a mesma tabela, e dois clientes podem
      // ter tabelas diferentes. Por isso ela é gravada aqui e não em
      // `onUpdateCustomerType`.
      const tprEscolhido = editTabela === "geral" ? null : Number(editTabela);
      const { error: tabelaError } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .update({ proxis_tpr_id: tprEscolhido })
        .eq("user_id", editCustomer.userId);
      if (tabelaError) throw tabelaError;

      if (editCustomer.cnpj && editType !== editCustomer.customerType) {
        await onUpdateCustomerType({
          userId: editCustomer.userId,
          cnpj: editCustomer.cnpj,
          customerType: editType,
        });
      }

      toast.success("Cadastro atualizado com sucesso.");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-customer-profiles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar cadastro.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Antes da lista, e nao depois: quem abre esta aba procurando um cliente
          que "nao aparece" precisa esbarrar nisto primeiro. A conta existe, so
          nao confirmou o e-mail — e sem o aviso aqui, a conclusao natural e que
          o cadastro nao foi feito. */}

      <div className="space-y-3 sm:space-y-4">
        <SectionHeader
          eyebrow="Clientes"
          title="Visão consolidada de quem compra com frequência"
          description="Use a busca para localizar registros e os filtros para organizar a lista."
          actions={
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
              {filteredCustomers.length} cliente(s)
            </Badge>
          }
        />

        {/* Sem a faixa, o filtro vindo de Preços seria uma armadilha: a lista
            encolhe e nada na tela diz por quê, nem como voltar. É a mesma
            faixa que a tela de Produtos usa para o filtro de categoria. */}
        {filtroDeTabela ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-[0.8125rem] text-foreground">
              Mostrando quem compra pela tabela{" "}
              <strong>{rotuloDaTabelaFiltrada}</strong> — {filteredCustomers.length} conta(s)
            </span>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => onFiltroDeTabelaChange(null)}
            >
              Ver todas
            </Button>
          </div>
        ) : null}

        <AdminListaPadrao
          busca={clientSearch}
          onBuscaChange={onClientSearchChange}
          buscaPlaceholder="Buscar por nome, empresa, telefone, CNPJ ou e-mail"
          contagem={filteredCustomers.length}
          filtros={
            <>
            {/* O recorte por tabela existia **só** quando alguém chegava vindo de
                Preços, pela faixa "Mostrando quem compra pela tabela X". Quem
                entrava direto em Clientes não tinha como fazer essa pergunta —
                e é ela que responde "quem está na tabela errada?". */}
            <Select
              value={filtroDeTabela ?? "todas"}
              onValueChange={(valor) => onFiltroDeTabelaChange(valor === "todas" ? null : valor)}
            >
              <SelectTrigger className="h-10 sm:h-9 w-[13rem] rounded-full text-[0.8125rem]">
                <SelectValue placeholder="Todas as tabelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as tabelas</SelectItem>
                {clientCustomerTypes.map((type) => (
                  <SelectItem key={`tipo:${type.name}`} value={`tipo:${type.name}`}>
                    Geral de {type.label}
                  </SelectItem>
                ))}
                {tabelasOferecidas(tabelasDePreco, null).map((tabela) => (
                  <SelectItem key={`negociada:${tabela.tprId}`} value={`negociada:${tabela.tprId}`}>
                    {rotuloDaTabela(tabela)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={clientFilter === "all" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
              onClick={() => onClientFilterChange("all")}
            >
              A-Z
            </Button>
            <Button
              type="button"
              variant={clientFilter === "orders" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
              onClick={() => onClientFilterChange("orders")}
            >
              Mais pedidos
            </Button>
            <Button
              type="button"
              variant={clientFilter === "revenue" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
              onClick={() => onClientFilterChange("revenue")}
            >
              Maior gasto
            </Button>
            </>
          }
          rodape={vendoPendentes ? null : <AdminPaginacao pagina={pagina} onMudarPagina={setPaginaAtual} />}
          abas={
            <>
          {/* ⚠️ A contagem vive **na aba**.

              Havia uma fileira de selos logo acima ("Cliente: 44, Funcionário:
              97, Sem tipo: 0…") repetindo, como texto, exatamente os tipos que
              estas abas filtram. Dois lugares para uma informação só — e a
              mesma duplicação existia em Administradores, com a legenda no
              rodapé em vez de no topo. Agora as duas telas contam no mesmo
              lugar: dentro do botão que filtra. */}
          <AbaDeTipo ativo={typeFilter === null} onClick={() => setTypeFilter(null)} total={customerSummaries.length}>
            Todos
          </AbaDeTipo>
          {clientCustomerTypes.map((type) => (
            <AbaDeTipo
              key={type.name}
              ativo={typeFilter === type.name}
              onClick={() => setTypeFilter(typeFilter === type.name ? null : type.name)}
              total={typeCounts[type.name] ?? 0}
            >
              {type.label}
            </AbaDeTipo>
          ))}
          <AbaDeTipo
            ativo={typeFilter === "unknown"}
            onClick={() => setTypeFilter(typeFilter === "unknown" ? null : "unknown")}
            total={typeCounts["unknown"] ?? 0}
          >
            Sem tipo
          </AbaDeTipo>

          {/* Só aparece quando há alguém esperando: uma aba permanente marcando
              zero ensina a ignorá-la, e é justamente ela que precisa ser notada
              no dia em que não estiver zerada. */}
          {pendentes.length > 0 ? (
            <Button
              type="button"
              variant={vendoPendentes ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
              onClick={() => setVendoPendentes((v) => !v)}
            >
              Aguardando confirmação
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums",
                  vendoPendentes ? "bg-primary-foreground/20" : "bg-warm/15 text-warm",
                )}
              >
                {pendentes.length}
              </span>
            </Button>
          ) : null}
            </>
          }
        >

          {vendoPendentes ? (
            <CadastrosPendentesSection comoAba />
          ) : (
          <AdminTabelaDePessoas
            itens={pagina.itens}
            chaveDoItem={getCustomerKey}
            onAbrirItem={openDetails}
            vazio="Nenhum cliente encontrado ainda."
            colunas={[
              {
                chave: "nome",
                rotulo: "Cliente",
                largura: "28%",
                celula: (customer) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                    <CelulaDePessoa
                      nome={customer.name}
                      detalhe={
                        <NomeDaEmpresa
                          company={customer.company}
                          cnpj={customer.cnpj}
                          isMei={customer.isMei}
                          fallback="Sem empresa vinculada"
                        />
                      }
                    />
                  </div>
                ),
              },
              {
                chave: "tipo",
                rotulo: "Tipo",
                largura: "12%",
                celula: (customer) =>
                  customer.customerType ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[0.6875rem] text-primary"
                    >
                      {customerTypeLabel(customer.customerType)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                chave: "contato",
                rotulo: "Contato",
                largura: "20%",
                ocultarAte: "xl",
                celula: (customer) => {
                  const perfil = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
                  return (
                    <div className="min-w-0 text-xs text-muted-foreground">
                      <p className="truncate">{perfil?.email || "—"}</p>
                      {customer.phone ? <p className="truncate">{formatPhone(customer.phone)}</p> : null}
                    </div>
                  );
                },
              },
              {
                chave: "cnpj",
                rotulo: "CNPJ",
                largura: "14%",
                ocultarAte: "xl",
                celula: (customer) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {customer.cnpj ? formatDocumentId(customer.cnpj) : "—"}
                  </span>
                ),
              },
              {
                chave: "pedidos",
                rotulo: "Pedidos",
                largura: "8%",
                alinhamento: "direita",
                celula: (customer) => <span className="tabular-nums">{customer.orders}</span>,
              },
              {
                chave: "total",
                rotulo: "Total gasto",
                largura: "10%",
                alinhamento: "direita",
                celula: (customer) => (
                  <span className="font-mono text-xs font-medium text-foreground">{formatBRL(customer.total)}</span>
                ),
              },
            ]}
            larguraDasAcoes="8%"
            acoes={(customer) => (
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => openEdit(customer)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Editar
              </Button>
            )}
            cartaoNoCelular={(customer) => {
              const perfil = customer.userId ? customerProfilesByKey.get(customer.userId) : null;
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-semibold text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <NomeDaEmpresa
                            company={customer.company}
                            cnpj={customer.cnpj}
                            isMei={customer.isMei}
                            fallback="Sem empresa vinculada"
                          />
                        </p>
                        {perfil?.email ? (
                          <p className="truncate text-[0.6875rem] text-muted-foreground/70">{perfil.email}</p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0 rounded-full px-3 text-xs"
                      onClick={() => openDetails(customer)}
                    >
                      Ver dados
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {customer.customerType ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[0.6875rem] text-primary"
                      >
                        {customerTypeLabel(customer.customerType)}
                      </Badge>
                    ) : null}
                    {customer.phone ? (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                        {formatPhone(customer.phone)}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Pedidos</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{customer.orders}</p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Total gasto</p>
                      <p className="mt-1 font-mono text-[0.8125rem] font-semibold text-foreground">
                        {formatBRL(customer.total)}
                      </p>
                    </div>
                  </div>
                </>
              );
            }}
          />
          )}
        </AdminListaPadrao>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[92dvh] w-[min(98vw,640px)] max-w-[640px] overflow-hidden rounded-[1.5rem] border-border/70 p-0")}>
          <div className={cn("flex max-h-[92dvh] flex-col overflow-hidden", MODAL_TELA_CHEIA_CORPO)}>
            <DialogHeader className="border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
              <DialogTitle className="text-left text-base sm:text-lg font-semibold tracking-tight text-foreground">
                Dados do cliente
              </DialogTitle>
              <DialogDescription className="text-left text-xs sm:text-[0.8125rem] text-muted-foreground">
                Cadastro, endereço e tabela de preço.
              </DialogDescription>
            </DialogHeader>

            {detailsCustomer ? (
              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4 sm:space-y-5">
                  <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">{detailsCustomer.name}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          <NomeDaEmpresa
                            company={detailsCustomer.company}
                            cnpj={detailsCustomer.cnpj}
                            isMei={detailsCustomer.isMei}
                            fallback="Sem empresa vinculada"
                          />
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary"
                      >
                        {detailsCustomer.customerType ? customerTypeLabel(detailsCustomer.customerType) : "Sem tipo"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      <DetailField label="Documento" value={formatDocumentId(detailsCustomer.cnpj ?? "") || "—"} />
                      <DetailField label="Telefone" value={detailsCustomer.phone || "—"} />
                      <DetailField label="E-mail" value={selectedDetailsProfile?.email || "—"} />
                      <DetailField label="Pedidos" value={String(detailsCustomer.orders)} />
                      <DetailField label="Total gasto" value={formatBRL(detailsCustomer.total)} />
                    </div>

                    {selectedDetailsProfile ? (
                      <div className="mt-2.5 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                          Perfil completo
                        </Badge>
                        <span>Cadastrado em {formatDateTime(selectedDetailsProfile.created_at)}</span>
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[0.6875rem] text-muted-foreground">
                        Cliente agregado por CNPJ — sem conta no front.
                      </p>
                    )}
                  </div>

                  {detailAddresses.length > 0 ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Endereço{detailAddresses.length > 1 ? "s" : ""}
                      </p>
                      <div className="mt-3 space-y-3">
                        {detailAddresses.map((addr) => (
                          <div key={addr.id} className="rounded-[1rem] border border-border/70 bg-muted/20 p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[0.8125rem] font-medium text-foreground">{addr.label}</span>
                              {addr.is_default ? (
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.625rem]">Padrão</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1.5 text-[0.8125rem] leading-5 text-foreground">
                              {[addr.street, addr.number].filter(Boolean).join(", ") || "—"}
                              {addr.complement ? `, ${addr.complement}` : ""}
                            </p>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {[addr.neighborhood, addr.city, addr.state].filter(Boolean).join(" · ")}
                              {addr.cep ? ` — CEP ${addr.cep}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedDetailsProfile ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Endereço (perfil)</p>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {[
                          selectedDetailsProfile.address_street,
                          selectedDetailsProfile.address_number,
                        ].filter(Boolean).join(", ") || "—"}
                        {selectedDetailsProfile.address_complement ? `, ${selectedDetailsProfile.address_complement}` : ""}
                      </p>
                      <p className="text-[0.8125rem] leading-6 text-muted-foreground">
                        {[
                          selectedDetailsProfile.address_neighborhood,
                          selectedDetailsProfile.address_city,
                          selectedDetailsProfile.address_state,
                        ].filter(Boolean).join(" · ")}
                        {selectedDetailsProfile.address_cep ? ` — CEP ${selectedDetailsProfile.address_cep}` : ""}
                      </p>
                    </div>
                  ) : null}

                  {selectedDetailsProfile ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Representante
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Select
                          value={draftRepresentanteId}
                          onValueChange={(value) => setDraftRepresentanteId(value)}
                        >
                          <SelectTrigger className="h-10 rounded-2xl flex-1">
                            <SelectValue placeholder="Selecionar representante" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_REPRESENTATIVE_VALUE}>Sem representante</SelectItem>
                            {adminUsers.filter((u) => u.is_active).map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.display_name || u.email} · {getRoleLabel(u.role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          className="h-10 rounded-2xl px-4 text-sm shrink-0"
                          disabled={
                            representanteSaving ||
                            draftRepresentanteId === (selectedDetailsProfile.representante_id ?? NO_REPRESENTATIVE_VALUE)
                          }
                          onClick={async () => {
                            setRepresentanteSaving(true);
                            try {
                              const { error } = await supabase.rpc("set_customer_representante", {
                                p_customer_user_id: selectedDetailsProfile.user_id,
                                p_representante_id:
                                  draftRepresentanteId === NO_REPRESENTATIVE_VALUE
                                    ? null
                                    : draftRepresentanteId || null,
                              });
                              if (error) throw error;
                              toast.success("Representante atualizado.");
                            } catch {
                              toast.error("Erro ao atualizar representante.");
                            } finally {
                              setRepresentanteSaving(false);
                            }
                          }}
                        >
                          {representanteSaving ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* O painel "Tabela de preço" saiu em 31/08/2026 com o ERP.
                      Mostrava PES ID, TPR, condição de pagamento e filial lidos
                      ao vivo do Proxis, mais um botão de sincronizar.

                      A tabela de preço do cliente continua existindo — é o que
                      define quanto ele paga — mas agora é definida no painel de
                      Preços, não descoberta perguntando ao ERP. */}
                  <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Tabela de preço
                    </p>
                    <p className="mt-2 text-[0.8125rem] text-foreground">
                      {selectedDetailsProfile?.proxis_tpr_id
                        ? `Tabela ${selectedDetailsProfile.proxis_tpr_id}`
                        : `Tabela geral de ${customerTypeLabel(normalizeCustomerType(selectedDetailsProfile?.customer_type))}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Para trocar, use a seção Preços.
                    </p>
                  </div>

                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open && !editSaving) setEditOpen(false); }}>
        {/* `overflow-x-hidden`: rede de segurança. Se um campo futuro voltar a
            ser mais largo que o diálogo, ele quebra em vez de arrastar tudo. */}
        <DialogContent className="max-h-[92dvh] w-[min(96vw,36rem)] max-w-[36rem] overflow-y-auto overflow-x-hidden rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]">
          <DialogHeader className="text-left">
            <DialogDescription className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
              Editar cadastro
            </DialogDescription>
            <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Editar dados do cliente
            </DialogTitle>
          </DialogHeader>

          {editCustomer ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-3 sm:p-3">
                <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                <p className="mt-1 text-sm sm:text-base font-semibold text-foreground">{editCustomer.name}</p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                   {editCustomer.company || "Sem empresa vinculada"} {editCustomer.cnpj ? `• ${formatDocumentId(editCustomer.cnpj)}` : ""}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-2xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-10 rounded-2xl" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">E-mail</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-10 rounded-2xl" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tabela de preço
                </Label>
                <Select value={editTabela} onValueChange={setEditTabela}>
                  <SelectTrigger className="h-10 rounded-2xl">
                    <SelectValue placeholder="Selecione a tabela" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* "Geral" primeiro porque é o caso comum: 105 das 143 contas
                        não têm tabela negociada e pagam pela tabela do tipo. */}
                    <SelectItem value="geral">Tabela geral de {customerTypeLabel(editType)}</SelectItem>
                    {tabelasOferecidas(
                      tabelasDePreco,
                      editTabela === "geral" ? null : Number(editTabela),
                    ).map((tabela) => (
                      <SelectItem key={tabela.tprId} value={String(tabela.tprId)}>
                        {rotuloDaTabela(tabela)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Uma tabela negociada vale <strong>só para esta conta</strong> e ganha da tabela do tipo. Os preços de
                  cada tabela continuam sendo editados na seção Preços.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tipo de cliente</Label>
                <div className="flex gap-2">
                  <Select value={editType} onValueChange={(value) => setEditType(value)}>
                    <SelectTrigger className="h-10 rounded-2xl flex-1">
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientCustomerTypes.map((type) => (
                        <SelectItem key={type.name} value={type.name}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* ⚠️ Leva para Preços; não abre mais um modal aqui.
                      O modal pedia um nome e pronto — e um tipo de conta criado
                      sem preço é um rótulo que não muda o que ninguém paga. Em
                      Preços o passo seguinte (dar preço ao tipo) está na mesma
                      tela, ao lado das tabelas. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-2xl shrink-0"
                    onClick={() => {
                      setEditOpen(false);
                      onIrParaPrecos();
                    }}
                    title="Criar ou apagar tipos, em Preços"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Observação</Label>
                <Input value={editObservation} onChange={(e) => setEditObservation(e.target.value)} maxLength={120} className="h-10 rounded-2xl" placeholder="Texto simples (máx. 120 caracteres)..." />
              </div>
            </div>
          ) : null}

          {/* ⚠️ `flex-wrap`, e antes não tinha.
              Quatro botões numa linha rígida — Cancelar, Salvar, Resetar senha,
              Excluir — somam ~560px num diálogo de 512px. Eles não encolhiam,
              então empurravam a largura do conteúdo inteiro e o formulário
              ficava cortado pela direita, com barra de rolagem horizontal.

              Agora as ações secundárias formam um grupo próprio e descem para a
              segunda linha quando não cabem, em vez de arrastar o diálogo. */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-10 rounded-2xl px-5 text-sm" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button type="button" className="h-10 rounded-2xl px-5 text-sm" onClick={handleEditSave} disabled={editSaving || !editCustomer?.userId}>
                {editSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
            {editCustomer?.userId ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-2xl px-4 text-[0.8125rem]"
                onClick={() =>
                  setAlvoDoReset({
                    userId: editCustomer.userId as string,
                    nome: editCustomer.name ?? "",
                    // `AdminCustomerSummary` nao carrega e-mail — ele vive no
                    // perfil. O dialogo usa o endereco para identificar a conta
                    // na confirmacao, entao vale procurar.
                    email:
                      customerProfiles.find((p) => p.user_id === editCustomer.userId)?.email ?? "",
                  })
                }
              >
                <KeyRound className="mr-1.5 h-4 w-4" />
                Resetar senha
              </Button>
            ) : null}
            {canDeleteCustomer ? (
              <ConfirmActionDialog
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-2xl border-destructive/40 px-4 text-[0.8125rem] text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {editCustomer?.userId ? "Excluir tudo" : "Excluir cliente"}
                  </Button>
                }
                title="Excluir conta e dados do cliente"
                description={
                  editCustomer?.userId
                    ? `Esta ação apaga permanentemente a conta, cadastro, carrinho/pedidos, endereços e histórico vinculados ao CNPJ de "${editCustomer?.name}". O acesso não poderá ser recuperado.`
                    : `Este é um cliente legado sem conta de acesso. A exclusão remove o cadastro consolidado, carrinho/pedidos, endereços e histórico, usando nome e/ou CNPJ para localizar registros antigos.`
                }
                confirmLabel="Excluir tudo"
                processingLabel="Apagando..."
                destructive
                onConfirm={async () => {
                  await deleteCustomerRecord({
                    userId: editCustomer?.userId,
                    cnpj: editCustomer?.cnpj,
                    name: editCustomer?.name,
                  });
                  toast.success("Cliente excluído permanentemente");
                  setEditOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["admin-customer-profiles"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                  queryClient.invalidateQueries({ queryKey: ["orders"] });
                }}
              />
            ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DialogoDeResetDeSenha
        alvo={alvoDoReset}
        onOpenChange={(aberto) => {
          if (!aberto) setAlvoDoReset(null);
        }}
      />
    </div>
  );
}
