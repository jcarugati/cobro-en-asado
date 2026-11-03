"use client";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="ticket">
      <h1>Cobro en Asado</h1>
      <section className="figures">
        <p className="tagline">No se pudieron cargar los precios.</p>
        <p>Probá de nuevo en un rato.</p>
        <div className="share-actions">
          <button type="button" className="print" onClick={() => retry()}>Reintentar</button>
          <a href="/">Ir al inicio</a>
        </div>
      </section>
    </main>
  );
}
