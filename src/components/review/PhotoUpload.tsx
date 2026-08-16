"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "./compress";

// Optional photo attachments for the private form. Guests pick from their
// library or camera; each shot is validated (type + size) and compressed on the
// device before it's ever held in state. Previews are square, removable, and the
// picker disappears once the cap is reached. Failures are shown inline, never
// thrown.

export type Photo = { id: string; dataUrl: string };

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_PICK_BYTES = 10 * 1024 * 1024; // 10 MB at the picker (spec)

export function PhotoUpload({
  photos,
  onChange,
  max,
  disabled,
}: {
  photos: Photo[];
  onChange: (next: Photo[]) => void;
  max: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (files.length === 0) return;

    setError("");
    setBusy(true);
    const room = max - photos.length;
    const next: Photo[] = [...photos];
    let rejected = 0;

    for (const file of files.slice(0, room)) {
      if (!ACCEPT.split(",").includes(file.type)) {
        rejected++;
        continue;
      }
      if (file.size > MAX_PICK_BYTES) {
        rejected++;
        continue;
      }
      try {
        const { dataUrl } = await compressImage(file);
        next.push({ id: crypto.randomUUID(), dataUrl });
      } catch {
        rejected++;
      }
    }

    if (files.length > room) {
      setError(`You can add up to ${max} photos.`);
    } else if (rejected > 0) {
      setError(
        rejected === 1
          ? "One photo couldn't be added — use JPEG, PNG or WEBP under 10 MB."
          : `${rejected} photos couldn't be added — use JPEG, PNG or WEBP under 10 MB.`
      );
    }
    onChange(next);
    setBusy(false);
  }

  function remove(id: string) {
    onChange(photos.filter((p) => p.id !== id));
  }

  const full = photos.length >= max;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5">
        {photos.map((p) => (
          <div
            key={p.id}
            className="pop-in relative aspect-square overflow-hidden rounded-xl border border-[rgba(26,23,18,0.1)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.dataUrl}
              alt="Attached photo"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <X size={13} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ))}

        {!full && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
            className={cn(
              "row grid aspect-square place-items-center rounded-xl border border-dashed border-[rgba(26,23,18,0.15)] bg-[#faf8f5] text-[#6a6459]",
              "transition-colors hover:border-[#b89b5e] hover:text-[#b89b5e] hover:bg-[#b89b5e]/5 disabled:opacity-50"
            )}
          >
            {busy ? (
              <Loader2 size={20} className="spin text-[#b89b5e]" aria-hidden />
            ) : (
              <ImagePlus size={20} strokeWidth={1.75} aria-hidden />
            )}
          </button>
        )}
      </div>

      <p id={hintId} className="mt-2 text-[12px] text-[#a7a093]">
        {photos.length}/{max} · JPEG, PNG or WEBP, up to 10 MB each
      </p>
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        capture="environment"
        className="hidden"
        onChange={onPick}
        tabIndex={-1}
      />
    </div>
  );
}
