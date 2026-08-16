import type { Metadata } from "next";
import { business } from "@/lib/content";
import { PlayAdmin } from "./PlayAdmin";

export const metadata: Metadata = {
  title: `Play & Win · Admin · ${business.name}`,
  robots: { index: false, follow: false },
};

export default function PlayAdminPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <PlayAdmin />
    </div>
  );
}
