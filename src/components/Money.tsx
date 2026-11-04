"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import * as Result from "effect/Result";
import { caretAfterGrouping, groupWhileTyping, parsePay, withDots } from "../domain/pay.ts";

export function Money({ id, label, value, onChange, example, note, large }: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  example: string;
  note?: string;
  large?: boolean;
}) {
  const parsed = parsePay(value);
  const invalid = Result.isFailure(parsed) && parsed.failure === "invalid";
  const [hint, setHint] = useState("");

  // Typing 1.200.000 with its dots passes through invalid text like 1.2, so the hint waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setHint(invalid ? `Escribilo así: ${example}` : ""), invalid ? 700 : 0);
    return () => clearTimeout(timer);
  }, [invalid, example, value]);

  function regroup(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const typed = field.value;
    const { inputType } = event.nativeEvent as InputEvent;
    // A paste may carry a decimal point, so it only gets dots if it already parses.
    if (inputType === "insertFromPaste" || inputType === "insertFromDrop") return onChange(withDots(typed));
    // Deleting from a valid amount only leaves its own group dots. Anything else may hold a dot meant as a decimal point.
    const grouped = groupWhileTyping(typed, invalid || !inputType?.startsWith("delete"));
    if (grouped !== typed) {
      const kept = typed.slice(0, field.selectionStart ?? typed.length).replace(/\./g, "").length;
      const caret = caretAfterGrouping(grouped, kept);
      // Delete steps over a dot, or it would stop there forever.
      const at = inputType === "deleteContentForward" && grouped[caret] === "." ? caret + 1 : caret;
      // Written here so React finds it already done and leaves the caret alone.
      field.value = grouped;
      field.setSelectionRange(at, at);
    }
    onChange(grouped);
  }

  return (
    <div className={large ? "money money-large" : "money"}>
      <label htmlFor={id}>{label}</label>
      <div className="field">
        <span aria-hidden="true">$</span>
        {/* numeric: iOS decimal pads show only the locale's comma, and pay is written with dots. */}
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={large}
          spellCheck={false}
          placeholder={large ? example : undefined}
          value={value}
          onChange={regroup}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint${note ? ` ${id}-note` : ""}`}
        />
      </div>
      {note && <p id={`${id}-note`} className="note">{note}</p>}
      <p id={`${id}-hint`} className="hint" aria-live="polite">{hint}</p>
    </div>
  );
}
