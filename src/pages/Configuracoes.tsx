import { useEffect, useState } from "react";
import { Loader2, Monitor, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmailTab } from "@/components/configuracoes/email-tab";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedback } from "@/lib/feedback";
import {
  DEFAULT_MAX_WIDTH,
  MAX_MAX_WIDTH,
  MIN_MAX_WIDTH,
  useLayoutSettings,
} from "@/lib/layout-settings";
import { useAuthz } from "@/lib/use-authz";

export default function Configuracoes() {
  const { maxWidth, loading, save } = useLayoutSettings();
  const { can, isAdmin } = useAuthz();
  const feedback = useFeedback();

  const podeEditar = isAdmin || can("configuracoes", "edit");
  const [valor, setValor] = useState<number>(maxWidth || DEFAULT_MAX_WIDTH);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(maxWidth);
  }, [maxWidth]);

  async function salvar() {
    setSalvando(true);
    try {
      await save(valor);
      feedback.showSuccess(
        "Configurações salvas",
        `A largura máxima do sistema agora é de ${valor}px.`,
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar as configurações de layout. Tente novamente.",
        err,
      );

    } finally {
      setSalvando(false);
    }
  }

  const alterado = valor !== maxWidth;

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Módulo · Configurações
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground">
          Configurações do sistema
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Ajuste as preferências gerais da aplicação. As alterações são aplicadas
          ao salvar.
        </p>
      </div>

      <div className="rounded-sm border border-border bg-background">
        <Tabs defaultValue="layout">
          <div className="border-b border-border px-4 pt-4 sm:px-6">
            <TabsList className="rounded-sm">
              <TabsTrigger value="layout" className="rounded-sm">
                Layout
              </TabsTrigger>
              <TabsTrigger value="email" className="rounded-sm">
                E-mail
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="email" className="m-0 p-4 sm:p-6">
            <EmailTab />
          </TabsContent>



          <TabsContent value="layout" className="m-0 p-4 sm:p-6">
            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="max-w-2xl space-y-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Largura máxima do sistema
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define a largura máxima do conteúdo em telas grandes
                      (header, menu, conteúdo e rodapé).
                    </p>
                  </div>
                </div>

                <div className="rounded-sm border border-border p-4 sm:p-5">
                  <div className="mb-4 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Largura
                    </span>
                    <span className="font-serif text-2xl text-foreground">
                      {valor}
                      <span className="ml-1 text-sm text-muted-foreground">px</span>
                    </span>
                  </div>

                  <Slider
                    value={[valor]}
                    min={MIN_MAX_WIDTH}
                    max={MAX_MAX_WIDTH}
                    step={20}
                    disabled={!podeEditar}
                    onValueChange={(v) => setValor(v[0])}
                  />

                  <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>{MIN_MAX_WIDTH}px</span>
                    <span>{MAX_MAX_WIDTH}px</span>
                  </div>
                </div>

                {!podeEditar && (
                  <p className="text-xs text-muted-foreground">
                    Você tem apenas permissão de visualização neste módulo.
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full rounded-sm sm:w-auto"
                    disabled={!alterado || salvando}
                    onClick={() => setValor(maxWidth)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="w-full rounded-sm sm:w-auto sm:min-w-32"
                    disabled={!podeEditar || salvando}
                    onClick={() => void salvar()}
                  >
                    {salvando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
