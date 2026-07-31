import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Monitor,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";


import { AppShell } from "@/components/app-shell";
import { CrmTab } from "@/components/configuracoes/crm-tab";
import { DestinosTab } from "@/components/configuracoes/destinos-tab";
import { EmailTab } from "@/components/configuracoes/email-tab";
import { EmpresaTab } from "@/components/configuracoes/empresa-tab";
import { IntegracaoTab } from "@/components/configuracoes/integracao-tab";

import { Button } from "@/components/ui/button";
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
import { useImageCropper } from "@/components/image-crop-modal";
import { comprimirImagem } from "@/lib/image-compress";
import { supabase } from "@/lib/supabase";

const BUCKET_SEO = "viagens";

export default function Configuracoes() {
  const { maxWidth, seo, loading, save } = useLayoutSettings();
  const { can, isAdmin } = useAuthz();
  const feedback = useFeedback();
  const { cropperUi, ajustarCorte } = useImageCropper({
    proporcoes: [
      { key: "1.91:1", label: "1.91:1 (compartilhamento)", valor: 1200 / 630 },
      { key: "16:9", label: "16:9", valor: 16 / 9 },
      { key: "1:1", label: "1:1 (quadrado)", valor: 1 },
    ],
    proporcaoPadrao: 1200 / 630,
    descricao:
      "Arraste a imagem para posicionar e use o zoom. A área visível será usada como miniatura ao compartilhar o link.",
  });

  const podeEditar = isAdmin || can("configuracoes", "edit");
  const [valor, setValor] = useState<number>(maxWidth || DEFAULT_MAX_WIDTH);
  const [salvando, setSalvando] = useState(false);
  const [formSeo, setFormSeo] = useState<SeoSettings>(seo);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const inputImagemRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValor(maxWidth);
  }, [maxWidth]);

  useEffect(() => {
    setFormSeo(seo);
  }, [seo]);

  /** Abre o corte, comprime e envia a imagem de compartilhamento. */
  async function enviarImagemSeo(arquivo: File | null) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      feedback.showNegative(
        "Arquivo inválido",
        `"${arquivo.name}" não é uma imagem.`,
      );
      return;
    }
    const recortado = await ajustarCorte(arquivo);
    if (!recortado) return;

    setEnviandoImagem(true);
    try {
      const otimizado = await comprimirImagem(recortado);
      const extensao = otimizado.name.split(".").pop() ?? "jpg";
      const caminho = `site/og-${crypto.randomUUID()}.${extensao}`;
      const { error } = await supabase.storage
        .from(BUCKET_SEO)
        .upload(caminho, otimizado, {
          upsert: false,
          contentType: otimizado.type,
          cacheControl: "31536000",
        });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET_SEO).getPublicUrl(caminho);
      setFormSeo((f) => ({ ...f, imageUrl: data.publicUrl }));
    } catch (err) {
      feedback.showError(
        "Não foi possível enviar",
        "Ocorreu um erro ao enviar a imagem de compartilhamento.",
        err,
      );
    } finally {
      setEnviandoImagem(false);
    }
  }


  const seoAlterado =
    formSeo.siteName !== seo.siteName ||
    formSeo.title !== seo.title ||
    formSeo.description !== seo.description ||
    formSeo.imageUrl !== seo.imageUrl;

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

                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        Imagem de compartilhamento
                        <HelpTip texto="Miniatura (1200x630) exibida ao compartilhar o link em WhatsApp e redes sociais. Envie uma imagem ou informe uma URL." />
                      </Label>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="grid h-[105px] w-[200px] shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-muted">
                          {formSeo.imageUrl ? (
                            <img
                              src={formSeo.imageUrl}
                              alt="Prévia da imagem de compartilhamento"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <input
                            ref={inputImagemRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              void enviarImagemSeo(e.target.files?.[0] ?? null);
                              e.target.value = "";
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <HintButton
                              hint="Escolha uma imagem do computador, ajuste o corte e envie."
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-sm"
                              disabled={!podeEditar || enviandoImagem}
                              onClick={() => inputImagemRef.current?.click()}
                            >
                              {enviandoImagem ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              Enviar imagem
                            </HintButton>
                            {formSeo.imageUrl && (
                              <HintButton
                                hint="Remove a imagem de compartilhamento atual."
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-sm"
                                disabled={!podeEditar || enviandoImagem}
                                onClick={() =>
                                  setFormSeo((f) => ({ ...f, imageUrl: "" }))
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                              </HintButton>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Tamanho recomendado: 1200x630 pixels (proporção 1.91:1).
                          </p>
                        </div>
                      </div>
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
