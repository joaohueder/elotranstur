import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza o conteúdo dentro de um iframe isolado, com a mesma folha de
 * estilos do sistema. Isso faz com que os breakpoints responsivos (mobile,
 * tablet e computador) funcionem de verdade na pré-visualização.
 */
export function DevicePreviewFrame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();

    doc.head.innerHTML = "";
    document
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((node) => doc.head.appendChild(node.cloneNode(true)));

    const meta = doc.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    doc.head.appendChild(meta);

    doc.documentElement.className = document.documentElement.className;
    doc.body.className = "bg-background text-foreground";
    doc.body.style.margin = "0";

    setBody(doc.body);
  }, [width]);

  return (
    <iframe
      ref={ref}
      title="Pré-visualização"
      className="mx-auto block border-0 bg-white"
      style={{ width, height }}
    >
      {body ? createPortal(children, body) : null}
    </iframe>
  );
}
