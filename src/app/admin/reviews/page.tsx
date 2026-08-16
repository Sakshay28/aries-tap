import type { Metadata } from "next";
import { business } from "@/lib/content";
import { ReviewsAdmin } from "./ReviewsAdmin";

export const metadata: Metadata = {
  title: `Reviews · ${business.name}`,
  robots: { index: false, follow: false },
};

export default function ReviewsAdminPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <ReviewsAdmin />
    </div>
  );
}
