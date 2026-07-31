import { useEffect, useState } from "react";
import { Loader2, Monitor, Save, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CrmTab } from "@/components/configuracoes/crm-tab";
import { DestinosTab } from "@/components/configuracoes/destinos-tab";
import { EmailTab } from "@/components/configuracoes/email-tab";
import { EmpresaTab } from "@/components/configuracoes/empresa-tab";

import { HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedback } from "@/lib/feedback";
import {
  DEFAULT_MAX_WIDTH,
  type SeoSettings,
  MAX_MAX_WIDTH,
  MIN_MAX_WIDTH,
  useLayoutSettings,
} from "@/lib/layout-settings";
import { useAuthz } from "@/lib/use-authz";

export default function Configuracoes() {
  const { maxWidth, seo, loading, save } = useLayoutSettings();
  const { can, isAdmin } = useAuthz();
  const feedback = useFeedback();

  const podeEditar = isAdmin || can("configuracoes", "edit");
  const [valor, setValor] = useState<number>(maxWidth || DEFAULT_MAX_WIDTH);
  const [salvando, setSalvando] = useState(false);
  const [formSeo, setFormSeo] = useState<SeoSettings>(seo);

  useEffect(() => {
    setValor(maxWidth);
  }, [maxWidth]);

  useEffect(() => {
    setFormSeo(seo);
  }, [seo]);

  const seoAlterado =
    formSeo.siteName !== seo.siteName ||
    formSeo.title !== seo.title ||
    formSeo.description !== seo.description;

  async function salvar() {
    setSalvando(true);
    try {
      await save(valor, formSeo);
      feedback.showSuccess(
        "Configurações salvas",
        `Largura máxima de ${valor}px e informações de SEO atualizadas.`,
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar as configurações de layout e SEO. Tente novamente.",
        err,
      );

    } finally {
      setSalvando(false);
    }
  }

  const alterado = valor !== maxWidth || seoAlterado;

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
              <TabsTrigger value="empresa" className="rounded-sm">
                Empresa
              </TabsTrigger>
              <TabsTrigger value="crm" className="rounded-sm">
                CRM
              </TabsTrigger>
              <TabsTrigger value="destinos" className="rounded-sm">
                Destinos
              </TabsTrigger>
              <TabsTrigger value="email" className="rounded-sm">
                E-mail
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="empresa" className="m-0 p-4 sm:p-6">
            <EmpresaTab />
          </TabsContent>

          <TabsContent value="crm" className="m-0 p-4 sm:p-6">
            <CrmTab />
          </TabsContent>

          <TabsContent value="destinos" className="m-0 p-4 sm:p-6">
            <DestinosTab />
          </TabsContent>


          <TabsContent value="email" className="m-0 p-4 sm:p-6">
            <EmailTab />
          </TabsContent>



          <TabsContent value="layout" className="m-0 p-4 sm:p-6">
            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="w-full space-y-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      Largura máxima do sistema
                      <HelpTip texto="Controla o tamanho máximo do conteúdo em telas grandes de computador." />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define a largura máxima do conteúdo em telas grandes
                      (header, menu, conteúdo e rodapé).
                    </p>
                  </div>
                </div>

                <div className="rounded-sm border border-border p-4 sm:p-5">
                  <div className="mb-4 flex items-baseline justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Largura
                      <HelpTip texto="Arraste para definir a largura máxima do conteúdo, em pixels." />
                    </span>
                    <span className="font-serif text-2xl text-foreground">
                      {valor}
                      <span className="ml-1 text-sm text-muted-foreground">px</span>
                    </span>
                  </div>

                  <Slider
                    aria-label="Largura máxima do sistema"
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

                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
                      <Search className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        SEO do site
                        <HelpTip texto="Informações que aparecem no Google e na miniatura ao compartilhar links do site." />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Usado nas páginas públicas. O sistema (painel e login)
                        nunca é indexado pelos buscadores.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-sm border border-border p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs">
                          Nome do site
                          <HelpTip texto="Nome da empresa/marca exibido junto ao título das páginas." />
                        </Label>
                        <Input
                          className="rounded-sm"
                          value={formSeo.siteName}
                          disabled={!podeEditar}
                          onChange={(e) =>
                            setFormSeo((f) => ({ ...f, siteName: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs">
                          Título padrão
                          <HelpTip texto="Título que aparece na aba do navegador e no resultado do Google (até 60 caracteres)." />
                        </Label>
                        <Input
                          className="rounded-sm"
                          maxLength={70}
                          value={formSeo.title}
                          disabled={!podeEditar}
                          onChange={(e) =>
                            setFormSeo((f) => ({ ...f, title: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        Descrição padrão
                        <HelpTip texto="Resumo do site mostrado abaixo do título no Google (até 160 caracteres)." />
                      </Label>
                      <Textarea
                        className="rounded-sm"
                        rows={3}
                        maxLength={180}
                        value={formSeo.description}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          setFormSeo((f) => ({ ...f, description: e.target.value }))
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {formSeo.description.length}/160 caracteres recomendados
                      </p>
                    </div>



                    <div className="rounded-sm bg-muted/60 p-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Indexação:</span>{" "}
                      apenas as landing pages públicas (/v/...) são liberadas para o
                      Google. Painel, login e recuperação de senha ficam com
                      <code className="mx-1">noindex</code>.
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <HintButton
                    hint="Desfaz as alterações e volta para os valores salvos anteriormente."
                    variant="outline"
                    className="w-full rounded-sm sm:w-auto"
                    disabled={!alterado || salvando}
                    onClick={() => {
                      setValor(maxWidth);
                      setFormSeo(seo);
                    }}
                  >
                    Cancelar
                  </HintButton>
                  <HintButton
                    hint="Grava a largura máxima e as informações de SEO do site."
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
                  </HintButton>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {cropperUi}
    </AppShell>

  );
}
