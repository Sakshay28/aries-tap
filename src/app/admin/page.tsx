import type { Metadata } from "next";
import { business } from "@/lib/content";
import { AdminClient } from "./AdminClient";

export const metadata: Metadata = {
  title: `Admin · ${business.name}`,
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AdminClient />
    </div>
  );
}
