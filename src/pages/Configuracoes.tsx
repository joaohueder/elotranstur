import { Monitor, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeo } from "@/lib/seo";
import {
  DEFAULT_APP_WIDTH,
  MAX_APP_WIDTH,
  MIN_APP_WIDTH,
  useLayoutSettings,
} from "@/lib/layout-settings";

export default function ConfiguracoesPage() {
  useSeo({
    title: "Configurações — ELO Transporte e Turismo",
    description:
      "Configurações do sistema ELO: preferências de layout, incluindo a largura máxima da interface.",
  });

  const { maxWidth, setMaxWidth, resetMaxWidth, isFullWidth, saveState } =
    useLayoutSettings();

  return (
    <AppShell>
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Sistema
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">
          Configurações
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Ajuste as preferências gerais do ELO. As alterações são aplicadas
          imediatamente e ficam salvas na sua conta, no banco de dados.
        </p>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
          {saveState === "saving"
            ? "Salvando…"
            : saveState === "saved"
              ? "Preferências salvas"
              : saveState === "error"
                ? "Não foi possível salvar no banco"
                : saveState === "loading"
                  ? "Carregando preferências…"
                  : ""}
        </p>
      </header>

      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="rounded-none">
          <TabsTrigger
            value="layout"
            className="rounded-none text-xs font-semibold uppercase tracking-widest"
          >
            Layout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="mt-8">
          <Card className="rounded-none border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Monitor className="size-5 text-brand-accent" />
                Largura máxima do sistema
              </CardTitle>
              <CardDescription>
                Define até onde o conteúdo se expande em telas grandes. Arraste
                o controle e veja o sistema se ajustando em tempo real.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-serif text-4xl text-foreground">
                    {isFullWidth ? "100%" : maxWidth}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    {isFullWidth ? "(tela cheia)" : "px"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none text-xs font-semibold uppercase tracking-widest"
                  onClick={resetMaxWidth}
                  disabled={maxWidth === DEFAULT_APP_WIDTH}
                >
                  <RotateCcw className="mr-2 size-3.5" />
                  Padrão
                </Button>
              </div>

              <Slider
                value={[maxWidth]}
                min={MIN_APP_WIDTH}
                max={MAX_APP_WIDTH}
                step={20}
                onValueChange={([value]) => setMaxWidth(value)}
                aria-label="Largura máxima do sistema"
              />

              <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
                <span>Compacto · {MIN_APP_WIDTH}px</span>
                <span>Tela cheia</span>
              </div>

              <div className="border-t border-border pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Pré-visualização
                </p>
                <div className="mt-3 border border-dashed border-border bg-muted/50 p-3">
                  <div
                    className="h-16 bg-brand-accent/15 ring-1 ring-brand-accent/40 transition-[width] duration-150"
                    style={{
                      width: isFullWidth
                        ? "100%"
                        : `${(maxWidth / MAX_APP_WIDTH) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
