"use client";

// "Which table are you at?" — the one question that turns an anonymous
// complaint into something a manager can act on before the guest leaves.
//
// Deliberately optional. A guest who won't answer still gets their WiFi and
// still gets to complain; we'd rather have an unattributed complaint than no
// complaint. It pre-fills from the visit's remembered answer, so most guests
// see it already filled and never think about it.

import { useEffect, useState } from "react";
import { currentTable, normalizeTable, rememberTable } from "@/lib/table/session";

export function TableField({
  value,
  onChange,
  tone = "dark",
}: {
  value: string;
  onChange: (v: string) => void;
  /** "dark" for the app's noir surfaces, "light" for the review sheet. */
  tone?: "dark" | "light";
}) {
  const [touched, setTouched] = useState(false);

  // Pre-fill once from the URL or this visit's remembered answer.
  useEffect(() => {
    if (touched || value) return;
    const t = currentTable();
    if (t) onChange(t);
    // Intentionally only on mount: later edits are the guest's, not ours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const light = tone === "light";

  return (
    <label className="block">
      <span
        className={
          light
            ? "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8a7f6e]"
            : "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-dim"
        }
      >
        Table number
        <span className={light ? "ml-1.5 font-normal normal-case tracking-normal text-[#a7a093]" : "ml-1.5 font-normal normal-case tracking-normal text-ink-faint"}>
          optional
        </span>
      </span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setTouched(true);
          const v = normalizeTable(e.target.value);
          onChange(v);
          rememberTable(v);
        }}
        placeholder="e.g. 12 or 5A"
        maxLength={12}
        className={
          light
            ? "w-full rounded-2xl border border-[#e3ddd1] bg-[#faf7f1] px-4 py-3 text-[15px] text-[#211c15] outline-none placeholder:text-[#a7a093] focus:border-[#b89b5e] focus:bg-white"
            : "w-full rounded-2xl border border-line bg-[var(--press)] px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        }
      />
    </label>
  );
}
