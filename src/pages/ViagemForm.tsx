import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  Laptop,
  Smartphone,
  Tablet,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AppShell } from "@/components/app-shell";
import { FieldLabel, HelpTip, HintButton, SectionTitle } from "@/components/help";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeedback } from "@/lib/feedback";
import { comprimirImagem } from "@/lib/image-compress";
import { useImageCropper } from "@/components/image-crop-modal";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_LANDING_MODEL,
  LANDING_MODELS,
  slugify,
} from "@/lib/landing-models";
import {
  DEFAULT_LANDING_PALETTE,
  LANDING_PALETTES,
  getLandingPalette,
} from "@/lib/landing-palettes";
import { LandingView } from "@/components/landing/landing-view";
import { DevicePreviewFrame } from "@/components/device-preview-frame";

const PREVIEW_DEVICES = {
  mobile: { nome: "Celular", largura: 390, altura: 720, icone: Smartphone },
  tablet: { nome: "Tablet", largura: 820, altura: 760, icone: Tablet },
  desktop: { nome: "Computador", largura: 1280, altura: 760, icone: Laptop },
} as const;
import { Switch } from "@/components/ui/switch";
import {
  VIAGEM_SITUACOES,
  maskValor,
  parseValor,
  type ViagemImagem,
  type ViagemSituacao,
} from "@/lib/viagens";

const BUCKET = "viagens";

export default function ViagemForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { cropperUi, ajustarCorte } = useImageCropper();

  const [loading, setLoading] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState("dados");
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destino, setDestino] = useState("");
  const [dataPartida, setDataPartida] = useState("");
  const [horaPartida, setHoraPartida] = useState("");
  const [situacao, setSituacao] = useState<ViagemSituacao>("rascunho");
  const [valor, setValor] = useState("");
  const [vagas, setVagas] = useState("");
  const [itens, setItens] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [arrastando, setArrastando] = useState<number | null>(null);

  const [imagens, setImagens] = useState<ViagemImagem[]>([]);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [arrastandoImg, setArrastandoImg] = useState<number | null>(null);
  const [landingModelo, setLandingModelo] = useState<string>(DEFAULT_LANDING_MODEL);
  const [landingPaleta, setLandingPaleta] = useState<string>(DEFAULT_LANDING_PALETTE);
  const [landingSlug, setLandingSlug] = useState("");
  const [landingAtiva, setLandingAtiva] = useState(true);
  const [previewModelo, setPreviewModelo] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] =
    useState<"mobile" | "tablet" | "desktop">("desktop");
  const inputArquivo = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("viagens")
          .select(
            "titulo, subtitulo, descricao, destino, data_partida, hora_partida, valor, vagas, itens_inclusos, imagens, situacao, landing_modelo, landing_paleta, landing_slug, landing_ativa",
          )
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!ativo || !data) return;
        setTitulo(data.titulo ?? "");
        setSubtitulo(data.subtitulo ?? "");
        setDescricao(data.descricao ?? "");
        setDestino(data.destino ?? "");
        setDataPartida(data.data_partida ?? "");
        setHoraPartida((data.hora_partida ?? "").slice(0, 5));
        setValor(maskValor(String(Math.round(Number(data.valor ?? 0) * 100))));
        setVagas(String(data.vagas ?? 0));
        setItens((data.itens_inclusos ?? []) as string[]);
        setImagens((data.imagens ?? []) as ViagemImagem[]);
        setSituacao((data.situacao ?? "rascunho") as ViagemSituacao);
        setLandingModelo((data.landing_modelo as string) ?? DEFAULT_LANDING_MODEL);
        setLandingPaleta(
          (data.landing_paleta as string) ?? DEFAULT_LANDING_PALETTE,
        );
        setLandingSlug((data.landing_slug as string) ?? "");
        setLandingAtiva(data.landing_ativa !== false);
      } catch (err) {
        feedback.showError(
          "Não foi possível carregar",
          "Ocorreu um erro ao carregar os dados da viagem.",
          err,
        );
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function adicionarItem() {
    const texto = novoItem.trim();
    if (!texto) return;
    if (itens.some((i) => i.toLowerCase() === texto.toLowerCase())) {
      feedback.showNegative("Item duplicado", "Este item já foi adicionado.");
      return;
    }
    setItens((prev) => [...prev, texto]);
    setNovoItem("");
  }

  /** Reordena os itens inclusos movendo o item de `origem` para `destinoIdx`. */
  function reordenar(origem: number, destinoIdx: number) {
    setItens((prev) => mover(prev, origem, destinoIdx));
  }

  function mover<T>(lista: T[], origem: number, destinoIdx: number): T[] {
    if (
      origem === destinoIdx ||
      origem < 0 ||
      destinoIdx < 0 ||
      origem >= lista.length ||
      destinoIdx >= lista.length
    ) {
      return lista;
    }
    const copia = [...lista];
    const [movido] = copia.splice(origem, 1);
    copia.splice(destinoIdx, 0, movido);
    return copia;
  }

  /** Envia as imagens escolhidas para o armazenamento e adiciona na galeria. */
  async function enviarImagens(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setEnviandoImagem(true);
    try {
      const novas: ViagemImagem[] = [];
      for (const arquivo of Array.from(arquivos)) {
        if (!arquivo.type.startsWith("image/")) {
          feedback.showNegative(
            "Arquivo inválido",
            `"${arquivo.name}" não é uma imagem.`,
          );
          continue;
        }
        // Abre o modal de corte antes do envio.
        const recortado = await ajustarCorte(arquivo);
        if (!recortado) continue;
        // Comprime antes de enviar: menor arquivo possível mantendo a qualidade.
        const otimizado = await comprimirImagem(recortado);
        const extensao = otimizado.name.split(".").pop() ?? "jpg";
        const caminho = `${id ?? "novas"}/${crypto.randomUUID()}.${extensao}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, otimizado, {
            upsert: false,
            contentType: otimizado.type,
            cacheControl: "31536000",
          });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
        novas.push({ url: data.publicUrl, path: caminho });
      }
      if (novas.length > 0) {
        setImagens((prev) => {
          const juntas = [...prev, ...novas];
          if (!juntas.some((i) => i.capa)) juntas[0] = { ...juntas[0], capa: true };
          return juntas;
        });
      }
    } catch (err) {
      feedback.showError(
        "Não foi possível enviar",
        "Ocorreu um erro ao enviar as imagens da galeria.",
        err,
      );
    } finally {
      setEnviandoImagem(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  function definirCapa(indice: number) {
    setImagens((prev) => prev.map((img, i) => ({ ...img, capa: i === indice })));
  }

  async function removerImagem(indice: number) {
    const alvo = imagens[indice];
    setImagens((prev) => {
      const restante = prev.filter((_, i) => i !== indice);
      if (restante.length > 0 && !restante.some((i) => i.capa)) {
        restante[0] = { ...restante[0], capa: true };
      }
      return restante;
    });
    if (alvo?.path) {
      await supabase.storage.from(BUCKET).remove([alvo.path]);
    }
  }

  async function salvar() {
    if (!destino.trim()) {
      setAba("dados");
      feedback.showNegative("Campo obrigatório", "Informe o destino da viagem.");
      return;
    }
    if (!dataPartida) {
      setAba("dados");
      feedback.showNegative(
        "Campo obrigatório",
        "Informe a data de partida da viagem.",
      );
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        titulo: titulo.trim() || null,
        subtitulo: subtitulo.trim() || null,
        descricao: descricao.trim() || null,
        destino: destino.trim(),
        data_partida: dataPartida,
        hora_partida: horaPartida || null,
        valor: parseValor(valor),
        vagas: Number(vagas) || 0,
        itens_inclusos: itens,
        imagens,
        situacao,
        landing_modelo: landingModelo,
        landing_paleta: landingPaleta,
        landing_slug:
          slugify(landingSlug || titulo || destino) ||
          slugify(destino) ||
          null,
        landing_ativa: landingAtiva,
      };
      const { error } = editando
        ? await supabase.from("viagens").update(payload).eq("id", id!)
        : await supabase.from("viagens").insert(payload);
      if (error) throw error;

      feedback.showSuccess(
        editando ? "Viagem atualizada" : "Viagem cadastrada",
        `${payload.destino} foi ${editando ? "atualizada" : "cadastrada"} com sucesso.`,
      );
      navigate("/viagens");
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar a viagem. Tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-4">
        <HintButton
          hint="Volta para a lista de viagens sem salvar alterações."
          variant="outline"
          size="icon"
          onClick={() => navigate("/viagens")}
        >
          <ArrowLeft className="h-4 w-4" />
        </HintButton>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · Viagens
          </p>
          <h1 className="mt-1 font-serif text-3xl text-foreground">
            {editando ? "Editar viagem" : "Nova viagem"}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="w-full rounded-sm border border-border bg-background">
          <Tabs value={aba} onValueChange={setAba}>
            <div className="flex items-center border-b border-border px-6 pt-6">
              <TabsList className="rounded-sm">
                <TabsTrigger value="dados" className="rounded-sm">
                  Dados da Viagem
                </TabsTrigger>
                <TabsTrigger value="apresentacao" className="rounded-sm">
                  Apresentação
                </TabsTrigger>
                <TabsTrigger value="galeria" className="rounded-sm">
                  Galeria de fotos
                </TabsTrigger>
                <TabsTrigger value="landing" className="rounded-sm">
                  Landing Page
                </TabsTrigger>
              </TabsList>
              <HelpTip
                className="ml-2"
                texto={
                  aba === "landing"
                    ? "Escolha o modelo da página pública que divulga a viagem e captura os interessados."
                    : aba === "apresentacao"
                    ? "Textos que o cliente vê divulgando a viagem."
                    : aba === "galeria"
                      ? "Fotos da viagem, com escolha da capa e ordenação."
                      : "Informações operacionais: destino, datas, preço e vagas."
                }
              />
            </div>

          <TabsContent value="apresentacao" className="m-0 p-6">
          <SectionTitle
            titulo="Apresentação"
            help="Textos que aparecem para o cliente divulgando a viagem."
          />
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="titulo" help="Nome chamativo da viagem, como aparece no anúncio.">
                Título
              </FieldLabel>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Natal Luz em Gramado"
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="subtitulo" help="Uma frase curta de apoio ao título, com o destaque da viagem.">
                Subtítulo
              </FieldLabel>
              <Input
                id="subtitulo"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="Ex.: 4 dias com hospedagem e passeios"
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="descricao" help="Explicação completa da viagem: roteiro, o que acontece em cada dia, observações.">
                Descrição
              </FieldLabel>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o roteiro e os detalhes da viagem."
                rows={5}
                className="mt-1.5"
              />
            </div>
          </div>

          </TabsContent>

          <TabsContent value="dados" className="m-0 p-6">
            <SectionTitle
              titulo="Dados da viagem"
              help="Informações operacionais: para onde vai, quando parte, preço e vagas."
            />
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="destino" help="Cidade ou local para onde a viagem vai acontecer.">
                Destino
              </FieldLabel>
              <Input
                id="destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Ex.: Gramado - RS"
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="data" help="Data em que os passageiros vão embarcar para a viagem.">
                Data de partida
              </FieldLabel>
              <Input
                id="data"
                type="date"
                value={dataPartida}
                onChange={(e) => setDataPartida(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="hora" help="Horário em que o ônibus sai no dia da partida.">
                Hora de partida
              </FieldLabel>
              <Input
                id="hora"
                type="time"
                value={horaPartida}
                onChange={(e) => setHoraPartida(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="valor" help="Preço cobrado por cada pessoa que for nesta viagem.">
                Valor por pessoa
              </FieldLabel>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor"
                  value={valor}
                  onChange={(e) => setValor(maskValor(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="vagas" help="Quantas pessoas cabem nesta viagem no total.">
                Quantidade de vagas
              </FieldLabel>
              <Input
                id="vagas"
                value={vagas}
                onChange={(e) => setVagas(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ex.: 45"
                inputMode="numeric"
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel help="Indica em que etapa a viagem está: rascunho, confirmada, etc.">
                Situação
              </FieldLabel>
              <Select
                value={situacao}
                onValueChange={(v) => setSituacao(v as ViagemSituacao)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIAGEM_SITUACOES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="item" help="Coisas que já estão incluídas no preço, como refeições e passeios.">
                Itens inclusos
              </FieldLabel>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="item"
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarItem();
                    }
                  }}
                  placeholder="Ex.: Café da manhã"
                />
                <HintButton
                  hint="Adiciona este item à lista de itens inclusos na viagem."
                  type="button"
                  variant="outline"
                  onClick={adicionarItem}
                >
                  <Plus className="h-4 w-4" />
                </HintButton>
              </div>

              {itens.length > 0 ? (
                <ul className="mt-3 divide-y divide-border rounded-sm border border-border">
                  {itens.map((item, i) => (
                    <li
                      key={`${item}-${i}`}
                      draggable
                      onDragStart={() => setArrastando(i)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (arrastando !== null && arrastando !== i) {
                          reordenar(arrastando, i);
                          setArrastando(i);
                        }
                      }}
                      onDragEnd={() => setArrastando(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setArrastando(null);
                      }}
                      className={`flex cursor-grab items-center gap-3 px-3 py-2 transition-opacity active:cursor-grabbing ${
                        arrastando === i ? "bg-muted opacity-60" : ""
                      }`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-6 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-sm text-foreground">
                        {item}
                      </span>
                      <HintButton
                        hint="Remove este item da lista de itens inclusos."
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setItens((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Remover ${item}`}
                      >
                        <X className="h-4 w-4" />
                      </HintButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum item incluso adicionado.
                </p>
              )}
            </div>
          </div>
          </TabsContent>

          <TabsContent value="galeria" className="m-0 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle
                titulo="Galeria de imagens"
                help="Fotos da viagem. As imagens são compactadas automaticamente para ocupar pouco espaço sem perder qualidade. Arraste para mudar a ordem e marque a estrela para escolher a capa."
              />
              <input
                ref={inputArquivo}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void enviarImagens(e.target.files)}
              />
              <HintButton
                hint="Escolhe fotos do seu computador e adiciona na galeria da viagem."
                type="button"
                variant="outline"
                disabled={enviandoImagem}
                onClick={() => inputArquivo.current?.click()}
              >
                {enviandoImagem ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Adicionar imagens
              </HintButton>
            </div>

            {imagens.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Nenhuma imagem adicionada. As fotos são compactadas
                automaticamente (até 1920px, formato WebP) e a primeira imagem
                enviada vira a capa.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {imagens.map((img, i) => (
                  <li
                    key={img.path || img.url}
                    draggable
                    onDragStart={() => setArrastandoImg(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (arrastandoImg !== null && arrastandoImg !== i) {
                        setImagens((prev) => mover(prev, arrastandoImg, i));
                        setArrastandoImg(i);
                      }
                    }}
                    onDragEnd={() => setArrastandoImg(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setArrastandoImg(null);
                    }}
                    className={`group relative cursor-grab overflow-hidden rounded-sm border transition-opacity active:cursor-grabbing ${
                      img.capa ? "border-primary" : "border-border"
                    } ${arrastandoImg === i ? "opacity-60" : ""}`}
                  >
                    <img
                      src={img.url}
                      alt={`Imagem ${i + 1} da viagem${titulo ? ` ${titulo}` : ""}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {img.capa && (
                      <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                        Capa
                      </span>
                    )}
                    <div className="absolute right-2 top-2 flex gap-1">
                      <HintButton
                        hint="Define esta foto como a capa da viagem."
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => definirCapa(i)}
                        aria-label="Definir como capa"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${img.capa ? "fill-current" : ""}`}
                        />
                      </HintButton>
                      <HintButton
                        hint="Remove esta foto da galeria."
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => void removerImagem(i)}
                        aria-label="Remover imagem"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </HintButton>
                    </div>
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <GripVertical className="h-3 w-3" />
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="landing" className="m-0 p-6">
            <SectionTitle
              titulo="Landing Page da viagem"
              help="Página pública para divulgar a viagem e receber contatos de interessados."
            />

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel help="Endereço público da página. Use apenas letras, números e hífen.">
                  Endereço da página
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {window.location.origin}/v/
                  </span>
                  <Input
                    value={landingSlug}
                    onChange={(e) => setLandingSlug(e.target.value)}
                    onBlur={() => setLandingSlug(slugify(landingSlug))}
                    placeholder={slugify(destino || "minha-viagem")}
                    className="rounded-sm"
                  />
                </div>
                {editando && landingSlug && (
                  <a
                    href={`/v/${slugify(landingSlug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary underline underline-offset-4"
                  >
                    Abrir página publicada
                  </a>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-sm border border-border p-4">
                <Switch
                  checked={landingAtiva}
                  onCheckedChange={setLandingAtiva}
                  aria-label="Landing page ativa"
                />
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    Página publicada
                    <HelpTip texto="Se desligado, a página fica indisponível para o público." />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Quando ligado, qualquer pessoa com o link consegue ver a viagem
                    e enviar o contato.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <SectionTitle
                titulo="Paleta de cores"
                help="Escolha as cores da página. A paleta pode ser combinada com qualquer modelo."
              />
              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {LANDING_PALETTES.map((pal) => {
                  const ativo = landingPaleta === pal.key;
                  return (
                    <button
                      key={pal.key}
                      type="button"
                      title={pal.descricao}
                      onClick={() => setLandingPaleta(pal.key)}
                      className={`rounded-sm border p-2 text-left transition-colors ${
                        ativo
                          ? "border-brand-accent ring-1 ring-brand-accent"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="flex h-8 w-full overflow-hidden rounded-sm">
                        <span className="flex-1" style={{ background: pal.bg }} />
                        <span className="flex-1" style={{ background: pal.surface }} />
                        <span className="flex-1" style={{ background: pal.accent }} />
                        <span className="flex-1" style={{ background: pal.accent2 }} />
                        <span className="flex-1" style={{ background: pal.fg }} />
                      </span>
                      <span className="mt-2 block text-xs font-medium text-foreground">
                        {pal.nome}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <SectionTitle
                titulo="Modelo visual"
                help="Escolha a estrutura da página: cada modelo tem layout, fonte e ícones próprios."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {LANDING_MODELS.map((m) => {
                  const ativo = landingModelo === m.key;
                  const pal = getLandingPalette(landingPaleta);
                  return (
                    <div
                      key={m.key}
                      onClick={() => setLandingModelo(m.key)}
                      title={m.descricao}
                      className={`rounded-sm border p-3 text-left transition-colors cursor-pointer ${
                        ativo
                          ? "border-brand-accent ring-1 ring-brand-accent"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span
                        className="mb-3 flex h-16 w-full items-end gap-1 overflow-hidden rounded-sm p-2"
                        style={{ background: pal.bg }}
                      >
                        <span
                          className="h-full w-1/3 rounded-sm"
                          style={{ background: pal.accent }}
                        />
                        <span className="flex-1 space-y-1">
                          <span
                            className="block h-2 w-full rounded-sm"
                            style={{ background: pal.fg, opacity: 0.85 }}
                          />
                          <span
                            className="block h-2 w-2/3 rounded-sm"
                            style={{ background: pal.muted, opacity: 0.6 }}
                          />
                          <span
                            className="block h-6 w-full rounded-sm"
                            style={{ background: pal.surface }}
                          />
                        </span>
                      </span>
                      <span className="block text-sm font-medium text-foreground">
                        {m.nome}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {m.descricao}
                      </span>
                      <HintButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 w-full text-xs font-semibold uppercase tracking-widest"
                        hint={`Abre uma pré-visualização do modelo ${m.nome} em uma janela sobreposta.`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModelo(m.key);
                        }}
                      >
                        <Eye className="mr-2 h-3.5 w-3.5" />
                        Preview
                      </HintButton>
                    </div>
                  );
                })}
              </div>
            </div>


            <Dialog
              open={!!previewModelo}
              onOpenChange={(open) => !open && setPreviewModelo(null)}
            >
              <DialogContent className="max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] gap-0 overflow-hidden rounded-sm border-border p-0">
                <DialogHeader className="border-b border-border px-6 py-4 text-left">
                  <DialogTitle className="font-serif text-xl text-foreground">
                    Pré-visualização · {LANDING_MODELS.find((m) => m.key === previewModelo)?.nome}
                  </DialogTitle>
                  <DialogDescription>
                    Veja como a página ficará para o cliente com os dados atuais.
                  </DialogDescription>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(
                      Object.keys(PREVIEW_DEVICES) as Array<
                        keyof typeof PREVIEW_DEVICES
                      >
                    ).map((chave) => {
                      const d = PREVIEW_DEVICES[chave];
                      const Icone = d.icone;
                      return (
                        <HintButton
                          key={chave}
                          type="button"
                          size="sm"
                          variant={previewDevice === chave ? "default" : "outline"}
                          hint={`Simula a página em ${d.nome} (${d.largura}px de largura).`}
                          onClick={() => setPreviewDevice(chave)}
                          className="h-8 text-xs"
                        >
                          <Icone className="mr-2 h-3.5 w-3.5" />
                          {d.nome}
                        </HintButton>
                      );
                    })}
                  </div>
                </DialogHeader>
                <div className="max-h-[calc(90vh-10rem)] overflow-auto bg-muted/40 p-4">
                  <DevicePreviewFrame
                    key={`${previewModelo}-${previewDevice}`}
                    width={PREVIEW_DEVICES[previewDevice].largura}
                    height={PREVIEW_DEVICES[previewDevice].altura}
                  >
                  <LandingView
                    preview
                    modelo={previewModelo ?? landingModelo}
                    paleta={landingPaleta}
                    viagem={{
                      id: id ?? "preview",
                      titulo: titulo || null,
                      subtitulo: subtitulo || null,
                      descricao: descricao || null,
                      destino: destino || "Destino da viagem",
                      data_partida: dataPartida || "2026-01-01",
                      hora_partida: horaPartida || null,
                      valor: parseValor(valor),
                      vagas: Number(vagas) || 0,
                      itens_inclusos: itens,
                      imagens,
                    }}
                  />
                  </DevicePreviewFrame>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <div className="flex justify-end gap-3 border-t border-border p-6">
            <HintButton
              hint="Descarta as alterações e volta para a lista de viagens."
              variant="outline"
              onClick={() => navigate("/viagens")}
            >
              Cancelar
            </HintButton>
            <HintButton
              hint="Grava os dados desta viagem no sistema."
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </HintButton>
          </div>
          </Tabs>
        </div>
      )}
      {cropperUi}
    </AppShell>
  );
}
