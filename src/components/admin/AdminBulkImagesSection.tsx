import { useCallback, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileImage, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  groupBulkMatchesByProduct,
  matchBulkImages,
  summarizeBulkMatches,
  type BulkImageMatch,
} from "@/lib/bulkProductImages";
import {
  PRODUCTS_TABLE,
  PRODUCT_MAX_IMAGES,
  getProductImageUrls,
  type Product,
} from "@/lib/products";
import { checkProductImage, PRODUCT_IMAGE_MIN_SIZE } from "@/lib/productImageNormalization";
import { PRODUCT_IMAGE_FRAME } from "@/lib/productImageNormalization";
import { uploadProductImageFile } from "@/lib/productImageStorage";
import { cn } from "@/lib/utils";
import { TEXT } from "@/lib/typography";

type Props = {
  products: Product[];
};

type UploadState = {
  running: boolean;
  done: number;
  total: number;
  failures: string[];
};

const STATUS_STYLE: Record<BulkImageMatch["status"], string> = {
  capa: "border-emerald-200 bg-emerald-50 text-emerald-700",
  galeria: "border-sky-200 bg-sky-50 text-sky-700",
  "sem-produto": "border-amber-200 bg-amber-50 text-amber-800",
  invalido: "border-red-200 bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<BulkImageMatch["status"], string> = {
  capa: "Capa",
  galeria: "Galeria",
  "sem-produto": "Sem produto",
  invalido: "Inválido",
};

export function AdminBulkImagesSection({ products }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ running: false, done: 0, total: 0, failures: [] });
  const [smallFiles, setSmallFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const matches = useMemo(() => matchBulkImages(files, products), [files, products]);
  const blockedFileNames = useMemo(() => new Set(smallFiles), [smallFiles]);
  const uploadableMatches = useMemo(
    () =>
      matches.filter(
        (match) => !blockedFileNames.has(match.file.name) && match.position <= PRODUCT_MAX_IMAGES,
      ),
    [matches, blockedFileNames],
  );
  const overLimitMatches = useMemo(
    () => matches.filter((match) => match.productId && match.position > PRODUCT_MAX_IMAGES),
    [matches],
  );
  const summary = useMemo(() => summarizeBulkMatches(uploadableMatches), [uploadableMatches]);
  const groups = useMemo(() => groupBulkMatchesByProduct(uploadableMatches), [uploadableMatches]);
  const problems = useMemo(
    () => uploadableMatches.filter((match) => !match.productId),
    [uploadableMatches],
  );

  const receiveFiles = useCallback(async (incoming: File[]) => {
    setValidating(true);
    setFiles([]);
    setSmallFiles([]);
    setUpload({ running: false, done: 0, total: 0, failures: [] });

    // Bloqueia cedo por resolucao: descobrir isso depois de subir 100 arquivos
    // significa poluir o storage e refazer o lote inteiro.
    const undersized: string[] = [];
    for (const file of incoming) {
      const check = await checkProductImage(file);
      if (check.isTooSmall) undersized.push(file.name);
    }
    setSmallFiles(undersized);
    setFiles(incoming);
    setValidating(false);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length > 0) void receiveFiles(selected);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (upload.running || validating) return;
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length > 0) void receiveFiles(dropped);
  };

  const reset = () => {
    setFiles([]);
    setSmallFiles([]);
    setValidating(false);
    setUpload({ running: false, done: 0, total: 0, failures: [] });
  };

  const confirmUpload = async () => {
    if (validating || groups.length === 0) return;

    const total = groups.reduce((sum, group) => sum + group.matches.length, 0);
    setUpload({ running: true, done: 0, total, failures: [] });

    const failures: string[] = [];
    let done = 0;

    for (const group of groups) {
      const product = products.find((item) => item.id === group.productId);
      if (!product) continue;

      // A posicao 1 substitui a capa; as demais entram na ordem enviada. O que
      // ja existia so e descartado quando o lote traz uma capa nova.
      const existing = getProductImageUrls(product);
      const uploadedByPosition = new Map<number, string>();

      for (const match of group.matches) {
        // O arquivo vai para o storage com o nome do proprio codigo, na posicao
        // em que entra: `12336.webp`, `12336_2.webp`. E a mesma convencao que o
        // lote usa para casar arquivo com produto, entao o que sobe hoje continua
        // reconhecivel amanha — e a biblioteca de imagens deixa de ser uma lista
        // de UUIDs.
        const nome = match.position === 1 ? group.code : `${group.code}_${match.position}`;
        const result = await uploadProductImageFile(match.file, {
          frame: PRODUCT_IMAGE_FRAME,
          nome,
        });
        done += 1;
        setUpload((state) => ({ ...state, done }));

        if (result.ok === false) {
          failures.push(`${match.fileName}: ${result.message}`);
          continue;
        }
        uploadedByPosition.set(match.position, result.publicUrl);
      }

      if (uploadedByPosition.size === 0) continue;

      const nextUrls = [...existing];
      for (const [position, url] of [...uploadedByPosition.entries()].sort((a, b) => a[0] - b[0])) {
        const index = position - 1;
        if (index < nextUrls.length) nextUrls[index] = url;
        else nextUrls.push(url);
      }

      const trimmed = nextUrls.slice(0, PRODUCT_MAX_IMAGES);
      const { error } = await supabase
        .from(PRODUCTS_TABLE)
        .update({ image_url: trimmed[0] ?? null, image_urls: trimmed } as never)
        .eq("id", group.productId);

      if (error) failures.push(`${group.productName}: ${error.message}`);
    }

    setUpload({ running: false, done, total, failures });
    await queryClient.invalidateQueries({ queryKey: ["products"] });

    if (failures.length === 0) {
      toast.success(`${done} imagem(ns) enviada(s) para ${groups.length} produto(s).`);
      setFiles([]);
      setSmallFiles([]);
    } else {
      toast.warning(`Lote concluído com ${failures.length} falha(s). Veja a lista abaixo.`);
    }
  };

  const progressValue = upload.total > 0 ? Math.round((upload.done / upload.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Sem cabeçalho próprio: a seção Imagens tem um só, acima das abas.
          Dois empilhados repetiam o mesmo "IMAGENS" com dois títulos. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Nomeie os arquivos com o código do produto e envie a pasta inteira de uma vez.
        </p>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
          {products.length} produto(s) no catálogo
        </Badge>
      </div>

      {/* Instrucao escrita para quem fotografa, nao para quem programa.
          A versao anterior falava em "sufixo", "posicao" e "o numero apos _ ou
          -", que descreve a regra do parser em vez de dizer o que fazer. Aqui
          sao dois passos, na ordem em que a pessoa executa. */}
      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <p className={cn(TEXT.label, "text-muted-foreground")}>Como nomear as fotos</p>

        <ol className="mt-4 space-y-4">
          <li className="flex gap-3">
            <span className={cn(TEXT.badge, "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary")}>
              1
            </span>
            <div className="min-w-0">
              <p className={cn(TEXT.body, "font-medium text-foreground")}>
                Dê ao arquivo o mesmo nome do código do produto
              </p>
              <p className={cn(TEXT.compact, "mt-1 leading-6 text-muted-foreground")}>
                O código aparece na lista de produtos, na coluna <strong className="font-medium text-foreground">Código</strong>.
                É por ele que a foto encontra o produto certo.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className={cn(TEXT.compact, "rounded-lg bg-muted px-2.5 py-1 font-mono text-foreground")}>12336.jpg</code>
                <span className={cn(TEXT.caption, "text-muted-foreground")}>→ vira a foto principal do produto 12336</span>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className={cn(TEXT.badge, "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary")}>
              2
            </span>
            <div className="min-w-0">
              <p className={cn(TEXT.body, "font-medium text-foreground")}>
                Tem mais de uma foto do mesmo produto? Numere a partir da segunda
              </p>
              <p className={cn(TEXT.compact, "mt-1 leading-6 text-muted-foreground")}>
                A ordem dos números é a ordem em que elas aparecem na página do produto.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className={cn(TEXT.compact, "rounded-lg bg-muted px-2.5 py-1 font-mono text-foreground")}>12336_2.jpg</code>
                <code className={cn(TEXT.compact, "rounded-lg bg-muted px-2.5 py-1 font-mono text-foreground")}>12336_3.jpg</code>
                <span className={cn(TEXT.caption, "text-muted-foreground")}>→ segunda e terceira fotos</span>
              </div>
            </div>
          </li>
        </ol>

        <p className={cn(TEXT.compact, "mt-4 rounded-xl bg-muted/40 px-3.5 py-2.5 leading-6 text-muted-foreground")}>
          Pode enviar em JPG, PNG ou WebP — e não precisa limpar o nome: coisas como
          {" "}<span className="font-mono">12336 (1).jpg</span> ou <span className="font-mono">12336 copy.jpg</span>{" "}
          funcionam do mesmo jeito.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border/70 bg-background",
        )}
      >
        <FileImage className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-semibold text-foreground">Arraste a pasta de fotos aqui</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">ou selecione os arquivos manualmente</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 rounded-full px-5"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.running || validating}
        >
          <Upload className="h-4 w-4" />
          {validating ? "Analisando imagens..." : "Selecionar arquivos"}
        </Button>
      </div>

      {files.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[0.6875rem] text-emerald-700">
              {summary.capas} capa(s)
            </Badge>
            <Badge className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[0.6875rem] text-sky-700">
              {summary.galeria} de galeria
            </Badge>
            {summary.semProduto > 0 ? (
              <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.6875rem] text-amber-800">
                {summary.semProduto} sem produto
              </Badge>
            ) : null}
            {summary.invalidos > 0 ? (
              <Badge className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.6875rem] text-red-700">
                {summary.invalidos} inválido(s)
              </Badge>
            ) : null}
            <Button type="button" variant="ghost" className="h-10 sm:h-9 rounded-full px-3 text-xs" onClick={reset}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>

          {smallFiles.length > 0 ? (
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {smallFiles.length} arquivo(s) abaixo de {PRODUCT_IMAGE_MIN_SIZE}px
              </p>
              <p className="mt-1 text-[0.8125rem] leading-6 text-amber-900/80">
                Não serão enviados ao storage: {smallFiles.slice(0, 6).join(", ")}
                {smallFiles.length > 6 ? ` e mais ${smallFiles.length - 6}` : ""}.
              </p>
            </div>
          ) : null}

          {overLimitMatches.length > 0 ? (
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {overLimitMatches.length} arquivo(s) acima do limite de {PRODUCT_MAX_IMAGES} fotos
              </p>
              <p className="mt-1 text-[0.8125rem] leading-6 text-amber-900/80">
                Não serão enviados ao storage: {overLimitMatches.slice(0, 6).map((match) => match.fileName).join(", ")}
                {overLimitMatches.length > 6 ? ` e mais ${overLimitMatches.length - 6}` : ""}.
              </p>
            </div>
          ) : null}

          {problems.length > 0 ? (
            <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Arquivos que não serão enviados</p>
              <ul className="mt-2 space-y-1">
                {problems.map((match) => (
                  <li key={match.fileName} className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[0.625rem]", STATUS_STYLE[match.status])}>
                      {STATUS_LABEL[match.status]}
                    </Badge>
                    <span className="font-mono text-foreground">{match.fileName}</span>
                    <span className="text-muted-foreground">{match.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {groups.length} produto(s) vão receber imagem
                </p>
                <Button
                  type="button"
                  className="h-11 rounded-full px-5"
                  onClick={confirmUpload}
                  disabled={upload.running || validating}
                >
                  {upload.running ? `Enviando ${upload.done}/${upload.total}...` : "Confirmar envio"}
                </Button>
              </div>

              {upload.running || upload.done > 0 ? (
                <Progress value={progressValue} className="mb-4 h-2" />
              ) : null}

              <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div
                    key={group.productId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium text-foreground">{group.productName}</p>
                      <p className="font-mono text-[0.6875rem] text-muted-foreground">{group.code}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.matches.map((match) => (
                        <Badge
                          key={match.fileName}
                          variant="outline"
                          className={cn("rounded-full px-2 py-0.5 text-[0.625rem]", STATUS_STYLE[match.status])}
                        >
                          {match.position === 1 ? "Capa" : `Foto ${match.position}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {upload.failures.length > 0 ? (
            <div className="rounded-[1.25rem] border border-red-200 bg-red-50/70 p-4">
              <p className="text-sm font-semibold text-red-800">Falhas no envio</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-red-900/80">
                {upload.failures.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!upload.running && upload.total > 0 && upload.failures.length === 0 ? (
            <div className="flex items-center gap-2 rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Lote enviado com sucesso.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
