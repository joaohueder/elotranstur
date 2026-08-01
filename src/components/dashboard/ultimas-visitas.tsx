import { useEffect, useState } from "react";
import { Eye, Loader2, MapPin, Timer } from "lucide-react";

import { HelpTip, HintButton } from "@/components/help";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUltimasVisitas, type VisitaDetalhada } from "@/lib/visitas";

function quando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function local(v: VisitaDetalhada) {
  return [v.cidade, v.regiao, v.pais].filter(Boolean).join(" · ") || "—";
}

function utm(v: VisitaDetalhada) {
  const partes = [
    v.utm_source && `source: ${v.utm_source}`,
    v.utm_medium && `medium: ${v.utm_medium}`,
    v.utm_campaign && `campaign: ${v.utm_campaign}`,
    v.utm_term && `term: ${v.utm_term}`,
    v.utm_content && `content: ${v.utm_content}`,
  ].filter(Boolean) as string[];
  return partes.length ? partes.join(" · ") : "—";
}

const JANELA_MS = 3 * 60 * 1000;

/** Contador regressivo dos 3 minutos em que a visita conta como online. */
function Expiracao({ visita, agora }: { visita: VisitaDetalhada; agora: number }) {
  const base = new Date(visita.updated_at || visita.created_at).getTime();
  const restante = base + JANELA_MS - agora;
  if (!Number.isFinite(base) || restante <= 0) return null;
  const total = Math.ceil(restante / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600">
      <Timer className="h-3 w-3" />
      {mm}:{ss}
    </span>
  );
}

/** Linha rótulo/valor do modal de detalhes. */
function Linha({ rotulo, valor }: { rotulo: string; valor?: unknown }) {
  const texto =
    valor === null || valor === undefined || valor === ""
      ? "—"
      : typeof valor === "object"
        ? JSON.stringify(valor)
        : String(valor);
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 border-b border-border/60 py-1.5 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="break-all text-foreground">{texto}</span>
    </div>
  );
}

/** Últimas 10 visitas registradas nas páginas públicas. */
export function UltimasVisitas() {
  const { visitas, loading } = useUltimasVisitas(10);
  const [detalhe, setDetalhe] = useState<VisitaDetalhada | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-sm border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Últimas 10 visitas
          <HelpTip texto="Registro das visitas mais recentes nas páginas públicas: de onde veio a pessoa, qual página abriu e se virou lead." />
        </p>
        <span className="text-[11px] text-muted-foreground">
          atualiza a cada 30s
        </span>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : visitas.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Nenhuma visita registrada ainda.
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[9.5rem]" />
                <col className="w-[4.5rem]" />
                <col />
                <col className="w-[7.5rem]" />
                <col />
                <col />
                <col className="hidden xl:table-column" />
                <col className="w-[6rem]" />
                <col className="w-[6.5rem]" />
              </colgroup>
              <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Data/hora</th>
                  <th className="px-2 py-2 font-medium">
                    <span className="inline-flex items-center gap-1">
                      Online
                      <HelpTip texto="Tempo restante para esta visita deixar de ser contada como online (3 minutos sem atividade)." />
                    </span>
                  </th>
                  <th className="px-2 py-2 font-medium">Cidade</th>
                  <th className="px-2 py-2 font-medium">IP</th>
                  <th className="px-2 py-2 font-medium">Página</th>
                  <th className="px-2 py-2 font-medium">Origem</th>
                  <th className="hidden px-2 py-2 font-medium xl:table-cell">UTM</th>
                  <th className="px-2 py-2 font-medium">Lead</th>
                  <th className="px-2 py-2 text-right font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr key={v.id} className="border-t border-border/70">
                    <td className="truncate px-2 py-2 tabular-nums">{quando(v.created_at)}</td>
                    <td className="px-2 py-2">
                      <Expiracao visita={v} agora={agora} />
                    </td>
                    <td className="truncate px-2 py-2" title={local(v)}>
                      {local(v)}
                    </td>
                    <td className="truncate px-2 py-2 font-mono" title={v.ip || "—"}>
                      {v.ip || "—"}
                    </td>
                    <td className="truncate px-2 py-2" title={v.path}>
                      {v.path}
                    </td>
                    <td
                      className="truncate px-2 py-2"
                      title={v.utm_source || v.referrer || "Direto"}
                    >
                      {v.utm_source || v.referrer || "Direto"}
                    </td>
                    <td className="hidden truncate px-2 py-2 xl:table-cell" title={utm(v)}>
                      {utm(v)}
                    </td>
                    <td className="truncate px-2 py-2">
                      {v.virou_lead ? (
                        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                          Sim
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Não</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <HintButton
                        hint="Abre todos os detalhes registrados desta visita"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-none px-2 text-[11px]"
                        onClick={() => setDetalhe(v)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Detalhe
                      </HintButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* Mobile */}
          <div className="divide-y divide-border lg:hidden">
            {visitas.map((v) => (
              <div key={v.id} className="space-y-1.5 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {quando(v.created_at)}
                    <Expiracao visita={v} agora={agora} />
                  </span>
                  {v.virou_lead && (
                    <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                      Lead
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {local(v)}
                </p>
                <p className="truncate text-muted-foreground">{v.path}</p>
                <HintButton
                  hint="Abre todos os detalhes registrados desta visita"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-none text-[11px]"
                  onClick={() => setDetalhe(v)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Ver detalhes
                </HintButton>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={detalhe !== null} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-[38rem]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif text-xl">
              Detalhes da visita
            </DialogTitle>
            <DialogDescription className="text-sm">
              Tudo o que foi registrado sobre este acesso.
            </DialogDescription>
          </DialogHeader>

          {detalhe && (
            <div className="mt-2">
              <Linha rotulo="Data/hora" valor={quando(detalhe.created_at)} />
              <Linha rotulo="Visitante (ID)" valor={detalhe.visitor_id} />
              <Linha rotulo="Página" valor={detalhe.path} />
              <Linha rotulo="Parâmetros" valor={detalhe.query} />
              <Linha rotulo="Veio de (referrer)" valor={detalhe.referrer} />
              <Linha rotulo="IP" valor={detalhe.ip} />
              <Linha rotulo="Cidade" valor={detalhe.cidade} />
              <Linha rotulo="Estado/Região" valor={detalhe.regiao} />
              <Linha rotulo="País" valor={detalhe.pais} />
              <Linha rotulo="Provedor" valor={detalhe.provedor} />
              <Linha rotulo="Dispositivo" valor={detalhe.dispositivo} />
              <Linha rotulo="Navegador" valor={detalhe.navegador} />
              <Linha rotulo="Sistema" valor={detalhe.sistema} />
              <Linha rotulo="Idioma" valor={detalhe.idioma} />
              <Linha rotulo="Resolução" valor={detalhe.resolucao} />
              <Linha rotulo="Fuso horário" valor={detalhe.fuso} />
              <Linha rotulo="User agent" valor={detalhe.user_agent} />
              <Linha rotulo="UTM source" valor={detalhe.utm_source} />
              <Linha rotulo="UTM medium" valor={detalhe.utm_medium} />
              <Linha rotulo="UTM campaign" valor={detalhe.utm_campaign} />
              <Linha rotulo="UTM term" valor={detalhe.utm_term} />
              <Linha rotulo="UTM content" valor={detalhe.utm_content} />
              <Linha rotulo="fbclid" valor={detalhe.fbclid} />
              <Linha rotulo="gclid" valor={detalhe.gclid} />
              <Linha rotulo="Virou lead" valor={detalhe.virou_lead ? "Sim" : "Não"} />
              <Linha rotulo="Lead" valor={detalhe.lead_nome} />
              <Linha rotulo="WhatsApp do lead" valor={detalhe.lead_whatsapp} />
              <Linha rotulo="Origem do lead" valor={detalhe.lead_origem} />
              <Linha rotulo="Etapa do lead" valor={detalhe.lead_etapa} />
              <Linha rotulo="Última atividade" valor={detalhe.updated_at ? quando(detalhe.updated_at) : null} />
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Registro completo
                </p>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all border border-border bg-muted/30 p-3 font-mono text-[11px] text-muted-foreground">
                  {JSON.stringify(detalhe.detalhes ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
