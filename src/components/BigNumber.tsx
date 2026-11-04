"use client";

import { useLayoutEffect, useState } from "react";
import { formatCount } from "../domain/format.ts";

export function BigNumber({ value, from }: { value: number; from: number }) {
  const target = Math.round(value);
  const [shown, setShown] = useState(from);

  useLayoutEffect(() => {
    const start = shown;
    if (start === target) return;
    // The size is fitted to the target, so counting down through longer numbers would overflow.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || formatCount(start).length > formatCount(target).length) {
      setShown(target);
      return;
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, Math.max(0, (now - began) / 650));
      setShown(Math.round(start + (target - start) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <span className="big">{formatCount(shown)}</span>;
}
