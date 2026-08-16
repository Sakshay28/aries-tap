import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { business } from "@/lib/content";
import { verifyToken } from "@/lib/wifi/session";
import { ADMIN_COOKIE, rewardById } from "@/lib/playwin/config";
import { getClaim } from "@/lib/playwin/db";
import { verifyRewardToken } from "@/lib/playwin/token";
import { RedeemPanel } from "./RedeemPanel";

export const metadata: Metadata = {
  title: `Redeem · ${business.name}`,
  robots: { index: false, follow: false },
};

// Staff-facing reward validation. A guest's QR points here. The token is
// verified (signature + expiry) before anything is shown, so a fabricated or
// edited code lands on the "invalid" state. Redeeming (single-use) needs the
// admin cookie; without it, a viewer can see the reward but not burn it.

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proof = await verifyRewardToken(token);
  const claim = proof ? await getClaim(proof.claimId) : null;

  if (!proof || !claim) {
    return (
      <Shell>
        <div className="glass card-in relative overflow-hidden rounded-3xl p-8 text-center">
          <div className="bord" aria-hidden />
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/12 text-danger">
            <ShieldAlert size={26} strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">Invalid reward</h1>
          <p className="mt-1 text-[14px] text-ink-dim">
            This code is invalid or has expired. Ask the guest to play again.
          </p>
          <Link href="/" className="row mt-6 inline-flex rounded-full border border-line px-4 py-2 text-[13px] font-medium">
            Home
          </Link>
        </div>
      </Shell>
    );
  }

  const isAdmin =
    (await verifyToken<{ kind?: string }>((await cookies()).get(ADMIN_COOKIE)?.value))?.kind ===
    "admin";
  const reward = rewardById(claim.rewardId);

  return (
    <Shell>
      <RedeemPanel
        token={token}
        isAdmin={isAdmin}
        reward={{
          title: claim.rewardTitle || reward?.title || "Reward",
          description: reward?.description ?? "",
          icon: reward?.icon ?? "Gift",
          color: reward?.color ?? "#c8a76e",
          terms: reward?.terms,
        }}
        couponCode={claim.couponCode}
        table={claim.table}
        status={claim.status}
        redeemedAt={claim.redeemedAt}
        redeemedBy={claim.redeemedBy}
        expiresAt={claim.expiresAt}
        createdAt={claim.createdAt}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="amb absolute left-[-20%] top-[24%] h-[50%] w-[140%]" aria-hidden />
      {children}
      <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
        {business.name} · Staff redemption
      </p>
    </div>
  );
}
