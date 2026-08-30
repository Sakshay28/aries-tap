// The venue's privacy notice — the destination of the consent link every guest
// sees before handing over a phone number (see WifiFlow's consent row).
//
// Written once for every Aries Tap venue: nothing here is hardcoded to a
// particular restaurant. The venue's name, address and phone come from
// `content.ts`, so onboarding a new venue publishes a correct notice without
// anyone editing this file — the same way every other surface in this app is
// configured.
//
// It describes what the code actually does, section by section: the WiFi lead
// store, the review funnel, the Play & Win claim form, the AI Host transcript
// log and the tap/scan events. When a feature starts collecting something new,
// this page is part of shipping it.

import type { Metadata } from "next";
import Link from "next/link";
import { business, location } from "@/lib/content";

export const metadata: Metadata = {
  title: `Privacy · ${business.name}`,
  description: `How ${business.name} handles the information you share through its Aries Tap experiences.`,
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-2 flex flex-col gap-2.5 text-[14px] leading-relaxed text-ink-dim">
        {children}
      </div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-medium text-ink">{label}</span> — {children}
    </p>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-6 pb-24 pt-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        {business.name}
      </p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Privacy
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        This explains what we collect when you scan or tap one of our table cards, and what we do
        with it. In plain language, and only what is actually true of this system.
      </p>

      <Section title="What we collect">
        <Item label="WiFi access">
          Your mobile number, so we can send the one-time code that unlocks the password. We store
          the number, the venue, the time, and whether you agreed to hear from us again.
        </Item>
        <Item label="Reviews and feedback">
          Your rating and anything you write. If you ask us to follow up, whatever contact details
          you choose to give. Photos only if you attach them.
        </Item>
        <Item label="Games and rewards">
          If you claim a prize, the details on the claim form — typically a name and phone number,
          and a birthday only if you enter one.
        </Item>
        <Item label="Conversations with our AI menu assistant">
          Questions you ask the assistant, and its replies, are saved so the restaurant can see what
          guests are asking about. Please do not type anything private or sensitive into the chat.
        </Item>
        <Item label="Which table you are at">
          Each table card carries its own code, so a scan tells us the table. This is how a comment
          about slow service reaches the right part of the room.
        </Item>
        <Item label="Basic technical details">
          Device type, browser, approximate city, and the time. Your IP address is stored only as a
          scrambled fingerprint used to block abuse — never the address itself.
        </Item>
      </Section>

      <Section title="Why we collect it">
        <p>
          To give you WiFi, run the games, answer your questions, and fix problems while you are
          still with us. Aggregated, it tells the restaurant which nights are busy and what guests
          keep asking for.
        </p>
        <p>
          If you opted in, we may occasionally send an offer or an invitation. You can tell any
          member of staff to stop, and we will.
        </p>
      </Section>

      <Section title="What we do not do">
        <p>
          We do not sell your information, and we do not share it with advertisers. We do not track
          you across other websites. We do not read the content of anything on your phone — only what
          you type into our own screens.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Only as long as it is useful for the reasons above, or as long as the law requires. Ask us
          to delete your information and we will remove it, unless we are obliged to keep a record.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask what we hold about you, ask us to correct it, or ask us to delete it. The
          fastest route is to speak to the team at the venue, or use the contact details below.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          {business.name}
          {location?.address ? <>, {location.address}</> : null}
        </p>
        {location?.phone ? (
          <p>
            <a href={`tel:${location.phone}`} className="text-accent underline underline-offset-2">
              {location.phoneDisplay || location.phone}
            </a>
          </p>
        ) : null}
      </Section>

      <p className="mt-10 border-t border-line pt-5 text-[12px] leading-relaxed text-ink-faint">
        Powered by Aries Tap. This notice covers the tap-and-scan experiences at this venue.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block text-[13px] text-accent underline underline-offset-2"
      >
        Back
      </Link>
    </main>
  );
}
