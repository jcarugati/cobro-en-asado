export function Sparkline({ series, productName }: { series: { product: number[]; ipc: number[] }; productName: string }) {
  const all = [...series.product, ...series.ipc];
  const low = Math.min(...all);
  const high = Math.max(...all);
  const yAt = (value: number) => 100 * (1 - Math.log(value / low) / Math.log(high / low));
  const points = (values: number[]) => values.map((value, index) => `${(index / (values.length - 1)) * 1000},${yAt(value) * 10}`).join(" ");
  const productEnd = yAt(series.product.at(-1)!);
  const ipcEnd = yAt(series.ipc.at(-1)!);
  const mid = (productEnd + ipcEnd) / 2;
  // In pixels around the midpoint, so two close ends stay readable and two far ends stay beside their own line, at any plot height.
  const labelTop = (end: number, other: number) => end < other ? `min(${end}%, calc(${mid}% - 8px))` : `max(${end}%, calc(${mid}% + 8px))`;

  return (
    <div className="spark" aria-hidden="true">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <polyline className="line-prices" points={points(series.ipc)} />
        <polyline className="line-product" points={points(series.product)} />
      </svg>
      <i className="end-dot dot-prices" style={{ top: `${yAt(1)}%`, left: 0 }} />
      <i className="end-dot dot-prices" style={{ top: `${ipcEnd}%`, left: "100%" }} />
      <i className="end-dot dot-product" style={{ top: `${productEnd}%`, left: "100%" }} />
      <span className="spark-label spark-product" style={{ top: labelTop(productEnd, ipcEnd) }}><i className="swatch swatch-product" />{productName}</span>
      <span className="spark-label" style={{ top: labelTop(ipcEnd, productEnd) }}><i className="swatch swatch-prices" />Inflación</span>
    </div>
  );
}
