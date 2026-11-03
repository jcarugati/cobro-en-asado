"use client";

import { UnitIcon } from "../src/components/UnitIcon.tsx";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="plain">
      <h1 className="brand"><UnitIcon unit="asado" />Cobro en Asado</h1>
      <section className="card">
        <p className="message">No se pudieron cargar los precios.</p>
        <p>Probá de nuevo en un rato.</p>
        <div className="share-actions">
          <button type="button" className="cta" onClick={() => retry()}>Reintentar</button>
          <a className="cta cta-quiet" href="/">Ir al inicio</a>
        </div>
      </section>
    </main>
  );
}
