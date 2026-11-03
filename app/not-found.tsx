import { UnitIcon } from "../src/components/UnitIcon.tsx";

export default function NotFound() {
  return (
    <main className="plain">
      <h1 className="brand"><UnitIcon unit="asado" />Cobro en Asado</h1>
      <section className="card">
        <p className="message">Esta página no existe.</p>
        <p>Si te pasaron el link, puede que esté incompleto.</p>
        <a className="cta" href="/">Ir al inicio</a>
      </section>
    </main>
  );
}
