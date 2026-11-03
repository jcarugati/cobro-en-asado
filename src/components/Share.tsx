"use client";

import { useEffect, useRef, useState } from "react";
import { afterShareError, type ShareTarget } from "../domain/share.ts";

const FILE_NAME = "cobro-en-asado.png";
const CARD_TIMEOUT_MS = 10_000;

export function Share({ target, comparing }: { target: ShareTarget | null; comparing: boolean }) {
  const [step, setStep] = useState<"idle" | "preparing" | "retry" | "fallback">("idle");
  const [note, setNote] = useState("");
  const [linkShown, setLinkShown] = useState(false);
  // A ref, not state: two taps in one frame must not both get through.
  const busy = useRef(false);
  // Calculator remounts this per path, which is what discards a kept file.
  const file = useRef<File | null>(null);
  const request = useRef<AbortController | null>(null);

  // A card still downloading when the pay changes must not open a share sheet for the old result.
  useEffect(() => () => request.current?.abort(), []);

  async function send(shared: ShareTarget, card: File, secondTap: boolean) {
    // Before the call: the image is ready and the sheet is open, so no status applies. The ref still blocks repeat taps.
    setStep("idle");
    try {
      await navigator.share({ files: [card], title: "Cobro en Asado", text: shared.text, url: location.origin + shared.path });
    } catch (error) {
      setStep(afterShareError(error instanceof Error ? error.name : "", secondTap));
    }
  }

  async function fetchThenSend(shared: ShareTarget) {
    // An empty probe, so a browser that cannot share files never requests the card.
    if (!navigator.canShare?.({ files: [new File([], FILE_NAME, { type: "image/png" })] })) return setStep("fallback");
    setStep("preparing");
    request.current = new AbortController();
    const timer = setTimeout(() => request.current?.abort(), CARD_TIMEOUT_MS);
    try {
      const response = await fetch(shared.card, { signal: request.current.signal });
      if (!response.ok) return setStep("fallback");
      file.current = new File([await response.blob()], FILE_NAME, { type: "image/png" });
    } catch {
      return setStep("fallback");
    } finally {
      clearTimeout(timer);
    }
    await send(shared, file.current, false);
  }

  function tap() {
    if (!target || busy.current) return;
    busy.current = true;
    setNote("");
    // With a kept file, send reaches navigator.share with no await first, inside this tap's activation.
    const work = file.current ? send(target, file.current, true) : fetchThenSend(target);
    void work.finally(() => {
      busy.current = false;
    });
  }

  async function copyLink(path: string) {
    try {
      await navigator.clipboard.writeText(location.origin + path);
      setNote("Link copiado");
    } catch {
      setNote("No se pudo copiar. Copialo de acá.");
      setLinkShown(true);
    }
  }

  const status = note || (step === "preparing" ? "Preparando la imagen…" : step === "retry" ? "Tocá de nuevo para compartir" : "");

  return (
    // Hidden, not removed: a block that comes and goes would move the presets below it under the finger that tapped one.
    <div className="share" style={target ? undefined : { visibility: "hidden" }}>
      <p id="share-warning">Con una calculadora se puede estimar tu sueldo a partir de esto.</p>
      {target && step === "fallback" ? (
        <div className="share-actions">
          <button type="button" autoFocus onClick={() => void copyLink(target.path)}>Copiar link</button>
          <a href={target.card} download={FILE_NAME} onClick={() => setNote("Descargando la imagen")}>Descargar imagen</a>
        </div>
      ) : (
        <button type="button" className="print" aria-describedby="share-warning" aria-busy={step === "preparing"} onClick={tap}>
          {/* The button is far from the comparison it sends, so it says so. */}
          {comparing ? "Compartir la comparación" : "Compartir"}
        </button>
      )}
      {target && linkShown && (
        <div className="money">
          <label htmlFor="share-link">Link para compartir</label>
          <div className="field">
            <input id="share-link" readOnly autoFocus value={location.origin + target.path} onFocus={(event) => event.currentTarget.select()} />
          </div>
        </div>
      )}
      <p className="hint" aria-live="polite">{status}</p>
    </div>
  );
}
