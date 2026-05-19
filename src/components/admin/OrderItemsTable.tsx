import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderTableLine } from "@/lib/orders";

type Props = {
  lines: OrderTableLine[];
};

export function OrderItemsTable({ lines }: Props) {
  if (lines.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
        Nenhum item neste pedido.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">Código</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="w-[72px] text-right">Qtd</TableHead>
            <TableHead className="w-[110px] text-right">Valor unit.</TableHead>
            <TableHead className="w-[110px] text-right">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={`${line.code}-${index}`}>
              <TableCell className="font-mono text-xs">{line.code}</TableCell>
              <TableCell>
                <p className="font-medium text-foreground">{line.name}</p>
                {(line.type || line.family) && (
                  <p className="text-xs text-muted-foreground">
                    {[line.type, line.family].filter(Boolean).join(" · ")}
                  </p>
                )}
                {line.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">Obs.: {line.notes}</p>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(line.unitPrice)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatBRL(line.subtotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
