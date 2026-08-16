// Per-tenant configuration for an Aries Tap page.
// One restaurant = one copy of this file. The component tree reads only from
// here, so onboarding a new venue never touches a component. Sections render
// only when their data exists — empty array = section hidden.

import type { StaticImageData } from "next/image";
import hero from "@/images/hero.webp";
import interior from "@/images/interior.webp";
import modbar from "@/images/modbar.jpg";
import lounge from "@/images/lounge.jpg";
import drinks from "@/images/drinks.jpg";
import mezze from "@/images/mezze.webp";
import pasta from "@/images/pasta.webp";
import bowl from "@/images/bowl.jpg";
import mural from "@/images/mural.jpg";
import pizza from "@/images/pizza.jpg";
import tartare from "@/images/tartare.webp";
import magnolia from "@/images/magnolia.webp";
import chaat from "@/images/chaat.webp";
import lazymojo from "@/images/lazymojo.webp";
import lazymojoFront from "@/images/lazymojo-front.jpg";
import lazymojoDark from "@/images/lazymojo-dark-aesthetic.webp";
// The house photography — shot on location, kept in their native portrait
// framing (see `taffetaGallery`).
import shot1 from "@/images/taffeta-shot-1.webp";
import shot2 from "@/images/taffeta-shot-2.webp";
import shot3 from "@/images/taffeta-shot-3.webp";
import taffetaSunburst from "@/images/taffeta-exterior-sunburst.webp";
import dupionBar from "@/images/dupion-bar.webp";
import lazymojo1 from "@/images/lazymojo-1.webp";
import lazymojo2 from "@/images/lazymojo-2.webp";
import lazymojo3 from "@/images/lazymojo-3.webp";
import magTerrace from "@/images/magnolia-terrace.webp";
import magEntrance from "@/images/magnolia-entrance.webp";
import chaatShot1 from "@/images/chaat-shot-1.webp";
import chaatShot2 from "@/images/chaat-shot-2.webp";
import chaatShot3 from "@/images/chaat-shot-3.webp";
// Real brand marks — background-stripped to transparent PNGs so they sit
// cleanly on the ivory page (see the image-processing step in the lobby work).
import logoTaffeta from "@/images/logo-taffeta.png";
import logoDupion from "@/images/logo-dupion.png";
import logoLazymojo from "@/images/logo-lazymojo.png";
import logoMagnolia from "@/images/logo-magnolia.png";
import logoChaat from "@/images/logo-chaat.png";

// --- Taffeta House Gallery (20 Photographs) ---
import taffeta1 from "@/images/galleries/taffeta/taffeta-1.webp";
import taffeta2 from "@/images/galleries/taffeta/taffeta-2.webp";
import taffeta3 from "@/images/galleries/taffeta/taffeta-3.webp";
import taffeta4 from "@/images/galleries/taffeta/taffeta-4.webp";
import taffeta5 from "@/images/galleries/taffeta/taffeta-5.webp";
import taffeta6 from "@/images/galleries/taffeta/taffeta-6.webp";
import taffeta7 from "@/images/galleries/taffeta/taffeta-7.webp";
import taffeta8 from "@/images/galleries/taffeta/taffeta-8.webp";
import taffeta9 from "@/images/galleries/taffeta/taffeta-9.webp";
import taffeta10 from "@/images/galleries/taffeta/taffeta-10.webp";
import taffeta11 from "@/images/galleries/taffeta/taffeta-11.webp";
import taffeta12 from "@/images/galleries/taffeta/taffeta-12.webp";
import taffeta13 from "@/images/galleries/taffeta/taffeta-13.webp";
import taffeta14 from "@/images/galleries/taffeta/taffeta-14.webp";
import taffeta15 from "@/images/galleries/taffeta/taffeta-15.webp";
import taffeta16 from "@/images/galleries/taffeta/taffeta-16.webp";
import taffeta17 from "@/images/galleries/taffeta/taffeta-17.webp";
import taffeta18 from "@/images/galleries/taffeta/taffeta-18.webp";
import taffeta19 from "@/images/galleries/taffeta/taffeta-19.webp";
import taffeta20 from "@/images/galleries/taffeta/taffeta-20.webp";

// --- Dupion Cocktail Room Gallery (18 Photographs) ---
import dupion1 from "@/images/galleries/dupion/dupion-1.webp";
import dupion2 from "@/images/galleries/dupion/dupion-2.webp";
import dupion3 from "@/images/galleries/dupion/dupion-3.webp";
import dupion4 from "@/images/galleries/dupion/dupion-4.webp";
import dupion5 from "@/images/galleries/dupion/dupion-5.webp";
import dupion6 from "@/images/galleries/dupion/dupion-6.webp";
import dupion7 from "@/images/galleries/dupion/dupion-7.webp";
import dupion8 from "@/images/galleries/dupion/dupion-8.webp";
import dupion9 from "@/images/galleries/dupion/dupion-9.webp";
import dupion10 from "@/images/galleries/dupion/dupion-10.webp";
import dupion11 from "@/images/galleries/dupion/dupion-11.webp";
import dupion12 from "@/images/galleries/dupion/dupion-12.webp";
import dupion13 from "@/images/galleries/dupion/dupion-13.webp";
import dupion14 from "@/images/galleries/dupion/dupion-14.webp";
import dupion15 from "@/images/galleries/dupion/dupion-15.webp";
import dupion16 from "@/images/galleries/dupion/dupion-16.webp";
import dupion17 from "@/images/galleries/dupion/dupion-17.webp";
import dupion18 from "@/images/galleries/dupion/dupion-18.webp";

// --- Cafe LazyMojo Gallery (20 Photographs) ---
import lazymojoG1 from "@/images/galleries/lazymojo/lazymojo-1.webp";
import lazymojoG2 from "@/images/galleries/lazymojo/lazymojo-2.webp";
import lazymojoG3 from "@/images/galleries/lazymojo/lazymojo-3.webp";
import lazymojoG4 from "@/images/galleries/lazymojo/lazymojo-4.webp";
import lazymojoG5 from "@/images/galleries/lazymojo/lazymojo-5.webp";
import lazymojoG6 from "@/images/galleries/lazymojo/lazymojo-6.webp";
import lazymojoG7 from "@/images/galleries/lazymojo/lazymojo-7.webp";
import lazymojoG8 from "@/images/galleries/lazymojo/lazymojo-8.webp";
import lazymojoG9 from "@/images/galleries/lazymojo/lazymojo-9.webp";
import lazymojoG10 from "@/images/galleries/lazymojo/lazymojo-10.webp";
import lazymojoG11 from "@/images/galleries/lazymojo/lazymojo-11.webp";
import lazymojoG12 from "@/images/galleries/lazymojo/lazymojo-12.webp";
import lazymojoG13 from "@/images/galleries/lazymojo/lazymojo-13.webp";
import lazymojoG14 from "@/images/galleries/lazymojo/lazymojo-14.webp";
import lazymojoG15 from "@/images/galleries/lazymojo/lazymojo-15.webp";
import lazymojoG16 from "@/images/galleries/lazymojo/lazymojo-16.webp";
import lazymojoG17 from "@/images/galleries/lazymojo/lazymojo-17.webp";
import lazymojoG18 from "@/images/galleries/lazymojo/lazymojo-18.webp";
import lazymojoG19 from "@/images/galleries/lazymojo/lazymojo-19.webp";
import lazymojoG20 from "@/images/galleries/lazymojo/lazymojo-20.webp";

// --- The Magnolia Gallery (18 Photographs) ---
import magnoliaG1 from "@/images/galleries/magnolia/magnolia-1.webp";
import magnoliaG2 from "@/images/galleries/magnolia/magnolia-2.webp";
import magnoliaG3 from "@/images/galleries/magnolia/magnolia-3.webp";
import magnoliaG4 from "@/images/galleries/magnolia/magnolia-4.webp";
import magnoliaG5 from "@/images/galleries/magnolia/magnolia-5.webp";
import magnoliaG6 from "@/images/galleries/magnolia/magnolia-6.webp";
import magnoliaG7 from "@/images/galleries/magnolia/magnolia-7.webp";
import magnoliaG8 from "@/images/galleries/magnolia/magnolia-8.webp";
import magnoliaG9 from "@/images/galleries/magnolia/magnolia-9.webp";
import magnoliaG10 from "@/images/galleries/magnolia/magnolia-10.webp";
import magnoliaG11 from "@/images/galleries/magnolia/magnolia-11.webp";
import magnoliaG12 from "@/images/galleries/magnolia/magnolia-12.webp";
import magnoliaG13 from "@/images/galleries/magnolia/magnolia-13.webp";
import magnoliaG14 from "@/images/galleries/magnolia/magnolia-14.webp";
import magnoliaG15 from "@/images/galleries/magnolia/magnolia-15.webp";
import magnoliaG16 from "@/images/galleries/magnolia/magnolia-16.webp";
import magnoliaG17 from "@/images/galleries/magnolia/magnolia-17.webp";
import magnoliaG18 from "@/images/galleries/magnolia/magnolia-18.webp";

// --- Chaat 'n' Chutneys Gallery (18 Photographs) ---
import chaatG1 from "@/images/galleries/chaat/chaat-1.webp";
import chaatG2 from "@/images/galleries/chaat/chaat-2.webp";
import chaatG3 from "@/images/galleries/chaat/chaat-3.webp";
import chaatG4 from "@/images/galleries/chaat/chaat-4.webp";
import chaatG5 from "@/images/galleries/chaat/chaat-5.webp";
import chaatG6 from "@/images/galleries/chaat/chaat-6.webp";
import chaatG7 from "@/images/galleries/chaat/chaat-7.webp";
import chaatG8 from "@/images/galleries/chaat/chaat-8.webp";
import chaatG9 from "@/images/galleries/chaat/chaat-9.webp";
import chaatG10 from "@/images/galleries/chaat/chaat-10.webp";
import chaatG11 from "@/images/galleries/chaat/chaat-11.webp";
import chaatG12 from "@/images/galleries/chaat/chaat-12.webp";
import chaatG13 from "@/images/galleries/chaat/chaat-13.webp";
import chaatG14 from "@/images/galleries/chaat/chaat-14.webp";
import chaatG15 from "@/images/galleries/chaat/chaat-15.webp";
import chaatG16 from "@/images/galleries/chaat/chaat-16.webp";
import chaatG17 from "@/images/galleries/chaat/chaat-17.webp";
import chaatG18 from "@/images/galleries/chaat/chaat-18.webp";


export type ThemeName = "noir" | "linen" | "forest";

export const business = {
  // Stable slug — the tenant key stored with every review + event, so the
  // schema is multi-tenant from day one even while one venue = one file.
  id: "taffeta",
  name: "Taffeta",
  meta: "Jaipur · Open till 11 PM",
  // Chosen during onboarding: noir (bars, fine dining), linen (cafés,
  // bakeries), forest (resorts, rooftops). The theme also sets the
  // atmosphere — noir drifts slow and warm, linen moves like daylight,
  // forest stays almost still.
  theme: "noir" as ThemeName,
  // Revealed only after a guest verifies their phone via OTP (see /wifi).
  wifi: { ssid: "Taffeta-Guest", password: "slowcoffee" },
  // Shown on the WiFi consent step. Point at the venue's real policy at go-live.
  privacyUrl: "/privacy",
};

// ————————————————————————————————— Review Experience
// Per-tenant configuration for the ⭐ Leave a Review flow. The whole point:
// lift the venue's public rating while catching an unhappy guest *before* they
// reach Google — a happy guest (rating ≥ googleThreshold) is invited to post
// publicly; anyone below is routed to a private, apologetic feedback form that
// only management sees. Every value here is safe to hand to onboarding.
export const review = {
  // Direct Google Maps review destination for Taffeta Coffee Jaipur.
  googleUrl: "https://maps.google.com/?q=Taffeta+Coffee+Jaipur",
  // Ratings at or above this go public; below it stays private. Spec default: 4.
  googleThreshold: 4,
  // Master switches — a venue can turn either capability off during onboarding.
  privateFeedback: true,
  imageUploads: true,
  // Up to N compressed photos on the private form.
  maxImages: 5,
  // The private thank-you copy (screen 3). Editable per venue.
  successMessage:
    "Your feedback has been sent privately to the management. We truly appreciate your honesty.",
  // Smart Review Recovery — if a low rating comes with positive-sounding words,
  // gently offer to revisit a public review once we've made it right.
  smartRecovery: true,
} as const;

export type ReviewConfig = typeof review;

// ————————————————————————————————— Play & Win
// The 🎮 tap-to-play growth engine. A guest taps a table tag, plays one premium
// game a day, and wins a real, redeemable reward — the venue collects a phone
// (and optionally WhatsApp/birthday/email + marketing opt-in) at claim time.
//
// Everything a restaurant needs to run it lives here — no code changes to
// onboard: toggle games, set the prize table, tune the odds (`weight`), cap the
// plays. The odds and lifetime caps are server-only; the browser never sees a
// weight, and the *outcome* of every play is decided and signed server-side
// (see src/lib/playwin/*). One reward per guest per day is the default posture.
import type { PlaywinConfig } from "@/lib/playwin/types";

export const playwin: PlaywinConfig = {
  enabled: true,
  headline: "Play & Win",
  subhead: "One tap. One prize. Only at the table.",
  // Fine print shown on the claim + reward screens.
  terms:
    "One reward per guest, per day. Show this screen to your server to redeem — it can be claimed once. Cannot be combined with other offers.",
  marketingConsentText:
    "Send me the occasional offer, event invite and birthday treat on WhatsApp.",
  // How long a won reward stays valid if not redeemed at the table right away.
  rewardTtlHours: 72,
  // Keep true to capture a phone before handing over the prize (the growth
  // engine). Set false for a pure fun/loyalty play with no gate.
  requireContactToClaim: true,

  // The prize catalog — shared across games, referenced by id in each game's
  // `slots`. Icons are lucide keys (mapped client-side). `weight` lives on the
  // slots, not here, so the same reward can be common in one game and rare in
  // another. Keep at least one `kind: "none"` slot for a believable near-miss.
  rewards: [
    {
      id: "off10",
      kind: "percent",
      title: "10% Off",
      description: "On your total bill today.",
      value: 10,
      icon: "BadgePercent",
      color: "#c8a76e",
      couponPrefix: "TAF10",
      terms: "Valid on today's bill. Dine-in only.",
    },
    {
      id: "off20",
      kind: "percent",
      title: "20% Off",
      description: "On your total bill today.",
      value: 20,
      icon: "BadgePercent",
      color: "#e0c28c",
      couponPrefix: "TAF20",
      minOrder: 500,
      terms: "On a bill of ₹500 or more. Dine-in only.",
    },
    {
      id: "coffee",
      kind: "freeItem",
      title: "Free Coffee",
      description: "A house pour, on us.",
      value: "House Latte",
      icon: "Coffee",
      color: "#b98d4e",
      couponPrefix: "TAFCOF",
      terms: "One house latte or filter coffee.",
    },
    {
      id: "dessert",
      kind: "freeItem",
      title: "Free Dessert",
      description: "Pick any dessert off the menu.",
      value: "Any dessert",
      icon: "IceCreamCone",
      color: "#cdbd8b",
      couponPrefix: "TAFSWT",
      terms: "One dessert of your choice, with any main.",
    },
    {
      id: "fries",
      kind: "freeItem",
      title: "Free Fries",
      description: "Truffle-salted, on the house.",
      value: "Truffle Fries",
      icon: "Utensils",
      color: "#efd9a6",
      couponPrefix: "TAFFRY",
    },
    {
      id: "bogo",
      kind: "bogo",
      title: "Buy 1 Get 1",
      description: "On any slow-bar drink.",
      value: "Any slow-bar drink",
      icon: "GlassWater",
      color: "#c8a76e",
      couponPrefix: "TAFB1G1",
      terms: "The complimentary drink is of equal or lesser value.",
    },
    {
      id: "mystery",
      kind: "mystery",
      title: "Mystery Gift",
      description: "Revealed by your server at the table.",
      icon: "Gift",
      color: "#e0c28c",
      couponPrefix: "TAFMYS",
    },
    {
      id: "none",
      kind: "none",
      title: "So close!",
      description: "No prize this spin — come back tomorrow for another try.",
      icon: "Clover",
      color: "#8a7f6e",
    },
  ],

  // The games on offer, in display order. Flip `enabled` to hide one. All seven
  // have a built engine (see the game registry); a game with no engine is simply
  // never shown. `dailyLimitPerDevice` powers "one play per 24h".
  games: [
    {
      key: "spin",
      enabled: true,
      name: "Spin the Wheel",
      tagline: "One spin decides your prize.",
      icon: "Disc3",
      dailyLimitPerDevice: 1,
      slots: [
        { rewardId: "off10", weight: 26 },
        { rewardId: "coffee", weight: 16 },
        { rewardId: "none", weight: 20 },
        { rewardId: "off20", weight: 8 },
        { rewardId: "fries", weight: 14 },
        { rewardId: "dessert", weight: 10 },
        { rewardId: "none", weight: 20 },
        { rewardId: "mystery", weight: 6 },
      ],
    },
    {
      key: "scratch",
      enabled: true,
      name: "Scratch Card",
      tagline: "Scratch to reveal what's underneath.",
      icon: "Sparkles",
      dailyLimitPerDevice: 1,
      slots: [
        { rewardId: "off10", weight: 28 },
        { rewardId: "coffee", weight: 18 },
        { rewardId: "dessert", weight: 12 },
        { rewardId: "off20", weight: 8 },
        { rewardId: "bogo", weight: 8 },
        { rewardId: "mystery", weight: 6 },
        { rewardId: "none", weight: 40 },
      ],
    },
    {
      key: "lucky",
      enabled: true,
      name: "Lucky Number",
      tagline: "Draw a number. Land in the winning range.",
      icon: "Dices",
      dailyLimitPerDevice: 1,
      slots: [
        { rewardId: "off10", weight: 30 },
        { rewardId: "fries", weight: 16 },
        { rewardId: "coffee", weight: 14 },
        { rewardId: "off20", weight: 7 },
        { rewardId: "dessert", weight: 8 },
        { rewardId: "none", weight: 45 },
      ],
    },
    {
      key: "flip",
      enabled: true,
      name: "Flip the Card",
      tagline: "Pick a card. Flip it. Win.",
      icon: "Layers",
      dailyLimitPerDevice: 1,
      // Three cards on screen; the one they pick flips to this drawn slot. The
      // others flip to a random near-miss — pure theatre, no effect on odds.
      slots: [
        { rewardId: "off10", weight: 26 },
        { rewardId: "coffee", weight: 16 },
        { rewardId: "fries", weight: 12 },
        { rewardId: "dessert", weight: 10 },
        { rewardId: "off20", weight: 7 },
        { rewardId: "mystery", weight: 6 },
        { rewardId: "none", weight: 30 },
      ],
    },
    {
      key: "memory",
      enabled: true,
      name: "Memory Match",
      tagline: "Match the pairs to unlock a reward.",
      icon: "LayoutGrid",
      dailyLimitPerDevice: 1,
      // A real 3-pair memory game gates the reveal; the reward is still drawn
      // server-side the moment the board is cleared.
      slots: [
        { rewardId: "off10", weight: 30 },
        { rewardId: "coffee", weight: 18 },
        { rewardId: "dessert", weight: 12 },
        { rewardId: "fries", weight: 12 },
        { rewardId: "off20", weight: 8 },
        { rewardId: "none", weight: 28 },
      ],
    },
    {
      key: "tap",
      enabled: true,
      name: "Tap Challenge",
      tagline: "Tap the target. Beat the clock.",
      icon: "Target",
      dailyLimitPerDevice: 1,
      // Beat the target to unlock your daily reward. Failing the challenge costs
      // no play (the draw only happens on success).
      slots: [
        { rewardId: "off10", weight: 28 },
        { rewardId: "fries", weight: 16 },
        { rewardId: "coffee", weight: 14 },
        { rewardId: "dessert", weight: 10 },
        { rewardId: "off20", weight: 8 },
        { rewardId: "none", weight: 26 },
      ],
    },
    {
      key: "box",
      enabled: true,
      name: "Daily Mystery Box",
      tagline: "One box a day. What's inside?",
      icon: "Package",
      dailyLimitPerDevice: 1,
      // The repeat-visit hook — a single, generous box every 24 hours.
      slots: [
        { rewardId: "off10", weight: 24 },
        { rewardId: "coffee", weight: 16 },
        { rewardId: "dessert", weight: 12 },
        { rewardId: "fries", weight: 10 },
        { rewardId: "mystery", weight: 12 },
        { rewardId: "off20", weight: 8 },
        { rewardId: "none", weight: 26 },
      ],
    },
  ],
};

// The cinematic backdrop behind the first screen.
export const heroImage: StaticImageData = hero;

export type ActionKey =
  | "menu"
  | "offers"
  | "instagram"
  | "review"
  | "wifi"
  | "play"
  | "ai";

export type Action = {
  key: ActionKey;
  label: string;
  href: string;
};

// The entire first screen: one column, one action per row. In-page anchors
// unfold the page into the matching section; full URLs open externally.
export const actions: Action[] = [
  { key: "menu", label: "Menu", href: "/menu.pdf" },
  { key: "offers", label: "Offers", href: "#specials" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/taffetacoffeeindia/" },
  // Not a link: this row opens the Review Experience modal (TapList intercepts
  // the "review" key). The Google URL lives in `review` below — a happy guest
  // is sent there, an unhappy one is kept private. Never wire this to Google.
  { key: "review", label: "Tap to Rate Us", href: "#review" },
  { key: "wifi", label: "WiFi", href: "/wifi" },
  { key: "play", label: "Play & Win", href: "/play" },
  { key: "ai", label: "Chat with AI", href: "/chat" },
];

export type Signature = {
  name: string;
  note: string;
  price: string;
  image: StaticImageData;
};

export const signatures: Signature[] = [
  {
    name: "The Slow Bar Trio",
    note: "Mint cooler, salted shake, house latte — poured together.",
    price: "₹640",
    image: drinks,
  },
  {
    name: "Mezze of the House",
    note: "Warm pita, falafel, four dips, pomegranate tabbouleh.",
    price: "₹520",
    image: mezze,
  },
  {
    name: "Pesto Burrata Rigatoni",
    note: "Basil crushed to order, burrata split at the table.",
    price: "₹480",
    image: pasta,
  },
];

export const story = {
  eyebrow: "The Space & Craft",
  title: "North India's Largest Coffee House",
  lines: [
    "A sunlit glasshouse sanctuary on JLN Marg, Jaipur, founded by Aziz Panwar & Shokat Panwar.",
    "Rooted in a 25-year hospitality legacy, featuring North India's first interactive Modbar brewing counter and in-house micro-roastery.",
  ],
  imageWide: interior,
  imageDetail: modbar,
};

export const gallery: { image: StaticImageData; alt: string }[] = [
  { image: taffeta1, alt: "Taffeta glasshouse facade illuminated with golden sunburst at twilight" },
  { image: taffeta2, alt: "Sunlit glasshouse exterior and canopy trees in morning daylight" },
  { image: taffeta3, alt: "Architectural Taffeta entryway signage and stone pavilion" },
  { image: taffeta4, alt: "Spacious outdoor garden patio seating under umbrella canopies" },
  { image: taffeta5, alt: "Morning sunlight streaming across fluted cane chairs and terrazzo tables" },
  { image: taffeta6, alt: "The signature Modbar slow bar recessed brewing counter and barista craft" },
  { image: taffeta7, alt: "Lounge seating area facing the house coffee roastery" },
  { image: taffeta8, alt: "Barista service in motion by the warm textured terracotta wall" },
  { image: taffeta9, alt: "The garden walkway and storefront beneath verdant trees" },
  { image: taffeta10, alt: "Cozy lounge corner with natural light and artisanal coffee books" },
  { image: taffeta11, alt: "The Slow Bar Trio — cold brew, matcha latte, and signature pour-over" },
  { image: taffeta12, alt: "House artisanal mezze platter with warm pita and assorted dips" },
  { image: taffeta13, alt: "Freshly rolled pesto burrata rigatoni with torn basil" },
  { image: taffeta14, alt: "Wood-fired artisanal sourdough garden pizza" },
  { image: taffeta15, alt: "Fresh avocado tartare on toasted sourdough slice" },
  { image: taffeta16, alt: "Vibrant harvest grain bowl with roasted seasonal veggies and microgreens" },
  { image: taffeta17, alt: "Hand-painted terracotta mural inspired by Jaipur architecture" },
  { image: taffeta18, alt: "Single-origin pour-over coffee served alongside fresh house bakes" },
  { image: taffeta19, alt: "The coffee slow bar with gleaming brass and marble finishes" },
  { image: taffeta20, alt: "Golden hour amber glow across the glasshouse dining pavilion" },
];

export type Special = {
  name: string;
  tag: string;
  price: string;
  image: StaticImageData;
};

export const specials: Special[] = [
  { name: "Harvest Bowl", tag: "Lunch only", price: "₹420", image: bowl },
  { name: "Garden Pizza", tag: "Today", price: "₹390", image: pizza },
  { name: "Avocado Tartare", tag: "Few left", price: "₹360", image: tartare },
];

export const events = [
  {
    title: "Vinyl & Espresso",
    description: "Deep-cut jazz records over slow-bar tastings.",
    day: "07",
    month: "Aug",
    time: "7:00 PM",
  },
  {
    title: "Latte Art Workshop",
    description: "Hands-on with our head barista, Rohan.",
    day: "08",
    month: "Aug",
    time: "11:00 AM",
  },
  {
    title: "Open Mic Night",
    description: "Acoustic sets, poetry, house-blend pours.",
    day: "12",
    month: "Aug",
    time: "8:00 PM",
  },
];

export const instagram = {
  handle: "@taffetacoffeeindia",
  url: "https://www.instagram.com/taffetacoffeeindia/",
  posts: [
    { image: pasta, alt: "Pesto rigatoni" },
    { image: drinks, alt: "The slow bar trio" },
    { image: mural, alt: "The mural corner" },
    { image: bowl, alt: "Harvest bowl" },
    { image: tartare, alt: "Avocado tartare" },
    { image: interior, alt: "Morning light in the glasshouse" },
  ],
};

export const reviews = {
  rating: 4.9,
  count: 812,
  quotes: [
    {
      text: "Feels like a boutique hotel lobby that happens to serve the best cold brew in Jaipur.",
      name: "Ananya R.",
    },
    {
      text: "The Modbar setup alone is worth the drive. Nobody rushes you here.",
      name: "Kabir M.",
    },
  ],
};

export const location = {
  address: "Plot 4, Jawahar Circle, Jaipur 302017",
  hours: [
    { days: "Mon — Fri", time: "7:00 AM — 11:00 PM" },
    { days: "Sat — Sun", time: "8:00 AM — 12:00 AM" },
  ],
  phone: "+919820000000",
  phoneDisplay: "+91 98200 00000",
  mapsUrl: "https://maps.google.com/?q=Taffeta+Coffee+Jawahar+Circle+Jaipur",
  mapEmbed: "https://maps.google.com/maps?q=Taffeta+Coffee+Jawahar+Circle+Jaipur&z=15&output=embed",
  bookUrl: "https://wa.me/919820000000?text=Table%20for%20two%2C%20please",
};

export type Sister = {
  name: string;
  tagline: string; // one line — what the place is
  cuisine: string;
  area: string; // neighbourhood, not full address
  rating: string;
  image: StaticImageData;
  mapsUrl: string;
};

// Other venues from the same owner. Empty array hides the section.
export const family = {
  eyebrow: "The Family",
  title: "More from our table.",
  venues: [
    {
      name: "The Magnolia",
      tagline: "Open-air garden theatre dining under the trees.",
      cuisine: "Italian · Mediterranean · Continental",
      area: "Smriti Van, Malviya Nagar",
      rating: "4.6",
      image: magEntrance,
      mapsUrl: "https://maps.google.com/?q=The+Magnolia+Garden+Theatre+Smriti+Van+JLN+Marg+Jaipur",
    },
    {
      name: "Chaat 'n' Chutneys",
      tagline: "Pure-veg street food, plated fresh.",
      cuisine: "Indian street food · North & South Indian",
      area: "Aldhara JDA, Malviya Nagar",
      rating: "4.1",
      image: chaat,
      mapsUrl: "https://maps.google.com/?q=Chaat+n+Chutneys+Jaldhara+JDA+JLN+Marg+Malviya+Nagar+Jaipur",
    },
    {
      name: "Cafe LazyMojo",
      tagline: "Cozy all-day cafe, bakery & banquet.",
      cuisine: "Italian · Bakery · Asian · Continental",
      area: "Malviya Nagar",
      rating: "4.2",
      image: lazymojoDark,
      mapsUrl: "https://maps.google.com/?q=Cafe+LazyMojo+SL+Marg+Malviya+Nagar+Jaipur",
    },
  ] as Sister[],
};

// ————————————————————————————————— Aries Tap Lobby
// The light, multi-brand landing shown on tap: Taffeta is the flagship, the
// three sisters are curated below it. This block is the ONLY data the lobby
// reads — onboarding a venue never touches a component. Icons are lucide keys
// mapped client-side (see src/components/lobby/*), so this file stays free of
// component imports, exactly like `actions` above.

export const taffeta = {
  monogram: "T",
  eyebrow: "Flagship · Jaipur",
  name: business.name, // "Taffeta"
  logo: logoTaffeta, // the brown coin emblem
  logoHeight: 101, // display height in px (square coin)
  tagline: "Curated food, conversations and unforgettable evenings.",
  instagramUrl: "https://www.instagram.com/taffetacoffeeindia/",
  instagramHandle: "@taffetacoffeeindia",
  photo: {
    image: taffetaSunburst,
    alt: "Taffeta Coffee glass facade, golden sunburst and landscaped entrance",
    focus: "center 50%",
  },
};

// The three house photographs, shown as an editorial triptych under the
// flagship's cards. All portrait — the strip keeps that framing rather than
// cropping them into a banner; tapping one opens it whole.
export const taffetaGallery: { image: StaticImageData; alt: string }[] = [
  { image: shot1, alt: "Service in motion past the Taffeta wall" },
  { image: shot2, alt: "The Taffeta storefront, under the trees" },
  { image: shot3, alt: "The lounge, facing the roastery" },
];

export const taffetaStory = {
  eyebrow: "Our Story · Jawahar Circle, Jaipur",
  title: "North India's Largest Coffee House & Specialty Roastery",
  tagline: "A luxury sanctuary of glass, pastel aesthetics, and white marble, born from a 25-year hospitality legacy.",
  heroImage: taffetaSunburst,
  detailImage: interior,
  modbarImage: modbar,
  loungeImage: lounge,
  locationBadge: "3 Mins from Jaipur Airport · JLN Marg",
  stats: [
    { value: "25+", label: "Years Heritage", note: "Hospitality in Jaipur" },
    { value: "#1", label: "Interactive Modbar", note: "First in North India" },
    { value: "Largest", label: "Coffee House", note: "In North India" },
    { value: "100%", label: "In-House Roastery", note: "Rare global estates" },
  ],
  founders: {
    names: ["Aziz Panwar", "Shokat Panwar"],
    role: "Co-Founders & Visionaries",
    experience: "25+ Years in Hospitality",
    vision: "Aziz and Shokat Panwar established Taffeta to bridge a vital gap in Jaipur's culinary and community landscape — pairing world-class specialty coffee roasting with a serene, design-forward environment where remote workers, travelers, and coffee connoisseurs gather effortlessly.",
    heritageText: "With a quarter-century of pioneering hospitality across Jaipur, the Panwar brothers have shaped the city's culinary culture through iconic dining destinations:",
    sisterBrands: [
      { name: "Cafe LazyMojo", type: "All-Day Café & Bakery", note: "Malviya Nagar's beloved gathering hub" },
      { name: "The Magnolia", type: "Open-Air Garden Theatre", note: "Dining under the trees at Smriti Van" },
      { name: "Dupion Cocktail Room", type: "Luxury Cocktail Lounge", note: "Intimate mixology & small plates" },
      { name: "Chaat 'n' Chutneys", type: "Pure-Veg Street Food", note: "Artisanal street food plated fresh" },
      { name: "LazyMojo Banquet", type: "Celebration & Event Space", note: "Grand hospitality & curated feasts" },
    ],
  },
  milestones: [
    {
      date: "March 2025",
      tag: "Official Debut",
      title: "The Grand Launch on JLN Marg",
      description: "Taffeta made its official debut near Jawahar Circle, instantly redefining the region's coffee landscape as North India's largest coffee house with its groundbreaking interactive modular brewing counter.",
    },
    {
      date: "August 2025",
      tag: "National Recognition",
      title: "Awarded Among India's Best Coffee Roasteries",
      description: "Honoured for unprecedented growth and uncompromising bean curation, evolving from Jaipur's flagship roastery into one of the country's most celebrated specialty coffee destinations.",
    },
  ],
  craft: [
    {
      title: "First Modbar in North India",
      tag: "Zero-Barrier Brewing",
      text: "Our futuristic Modbar setup conceals all heavy boiler machinery beneath sculpted marble counters, leaving only polished chrome taps visible. This removes every physical barrier between guest and barista, turning each pour into an intimate, interactive masterclass.",
    },
    {
      title: "In-House Micro-Roastery",
      tag: "Rare Global Terroirs",
      text: "Taffeta houses a dedicated in-house roasting facility where ethically sourced, micro-lot green beans from world-renowned plantations are profiled with scientific precision to unlock delicate floral notes, fruit brightness, and velvety chocolate finishes.",
    },
  ],
  signatures: [
    {
      category: "Specialty Coffee",
      items: [
        {
          name: "Pistachio Cloud Cold Brew",
          tag: "House Signature",
          description: "Slow-steeped single origin cold brew topped with our velvety, hand-whipped roasted pistachio cream cloud.",
        },
        {
          name: "Sea Salt Vietnamese Coffee",
          tag: "Crowd Favourite",
          description: "Bold dark roast dripped through traditional phin, harmonised with sweetened condensed milk and mineral sea salt foam.",
        },
      ],
    },
    {
      category: "Artisanal Bakery & Desserts",
      items: [
        {
          name: "Midnight Chocolate Cake",
          tag: "Pastry Pride",
          description: "Decadent multi-layered dark chocolate sponge with 70% single-origin ganache and cocoa velvet finish.",
        },
        {
          name: "Slow-Fermented Croissants",
          tag: "Baked Daily from Scratch",
          description: "Laminated French butter pastry fermented for 36 hours for exceptional honeycomb flakiness and golden crunch.",
        },
        {
          name: "Signature Tres Leches",
          tag: "Chef's Special",
          description: "Ultra-tender sponge cake steeped overnight in a trio of infused rich milks, crowned with fresh chantilly.",
        },
      ],
    },
  ],
  space: {
    title: "Sanctuary for Creators & Travelers",
    description: "Located just 3 minutes from the Jaipur Airport on JLN Marg, Taffeta spans expansive indoor pastel marble seating and lush outdoor alfresco garden corners. Thoughtfully engineered with high-speed Wi-Fi, accessible power outlets, and unhurried hospitality, it is an effortless haven for remote work, business rendezvous, and quiet contemplation.",
    features: [
      "3 Minutes from Jaipur International Airport",
      "Ergonomic Remote-Work & Meeting Friendly Zones",
      "Sprawling Indoor Pastel & White Marble Interiors",
      "Lush Outdoor Garden Seating",
      "Zero-Barrier Modbar Espresso Counter",
      "In-House Micro-Roastery & Cupping Lab",
    ],
  },
  quote: "Curated food, conversations and unforgettable evenings.",
  signature: "Aziz Panwar & Shokat Panwar · Taffeta Coffee, Jaipur",
};

export type LobbyActionKind = "review" | "link" | "gallery" | "story";
export type LobbyIconKey = "review" | "menu" | "wifi" | "instagram" | "ai" | "gallery" | "story";

export type LobbyAction = {
  key: string;
  label: string;
  hint?: string; // optional small subtitle under the title
  icon: LobbyIconKey;
  href: string;
  kind: LobbyActionKind;
};

// Row 1: Tap to Rate Us, Wi-Fi, Know About Menu (AI chat)
// Row 2: Gallery, Menu, Taffeta's Story
export const taffetaActions: LobbyAction[] = [
  { key: "review", label: "Tap to Rate Us", hint: "Google Reviews", icon: "review", href: "#review", kind: "review" },
  { key: "wifi", label: "Wi-Fi", icon: "wifi", href: "/wifi", kind: "link" },
  { key: "ai", label: "Know About Menu", hint: "Ask our AI", icon: "ai", href: "/chat", kind: "link" },
  { key: "gallery", label: "Gallery", icon: "gallery", href: "/gallery?venue=taffeta", kind: "gallery" },
  { key: "menu", label: "Menu", icon: "menu", href: "/menu.pdf", kind: "link" },
  { key: "story", label: "Taffeta's Story", hint: "The Space & Craft", icon: "story", href: "#story", kind: "story" },
];

export type VenuePhoto = {
  image: StaticImageData;
  alt: string;
  // object-position for the cropped tile; the viewer always shows the full frame.
  focus?: string;
};

export type MenuIconKey = "food" | "cocktails" | "spirits";

// A venue with more than one menu lists them in a sheet instead of linking
// straight to a PDF. `note` is the one-line hint under each title.
export type VenueMenu = {
  label: string;
  note: string;
  icon: MenuIconKey;
  href: string;
};

export type LobbyVenue = {
  id: string;
  name: string;
  logo: StaticImageData; // the venue's real brand mark (transparent)
  logoHeight: number; // display height in px — tuned per mark so they optically match
  note: string; // one editorial line — what the place is
  cuisine: string;
  area: string;
  address: string;
  instagramUrl: string;
  instagramHandle: string;
  // Not trading yet — shows "Opening soon" badge alongside the address.
  // Declared, not inferred from missing links, so a venue that gains a photo
  // or a menu doesn't silently stop reading as upcoming.
  openingSoon?: boolean;
  // Photography of the room, shown under the venue's cards. Every frame is
  // stored whole and framed by `focus` (an object-position), so the viewer can
  // still open the uncropped original. Give a venue EITHER a single `photo`
  // (one wide 2:1 frame) OR a `strip` (a portrait triptych, like the flagship).
  photo?: VenuePhoto;
  strip?: VenuePhoto[];
  // A card renders "Soon" (dashed, non-interactive) whenever its destination
  // is missing: no `menu`, no `mapsUrl`, or an empty `gallery`.
  menu?: string;
  // Use INSTEAD of `menu` when a venue has several menus — the Menu card then
  // opens a picker rather than a PDF.
  menus?: VenueMenu[];
  mapsUrl?: string;
  gallery: { image: StaticImageData; alt: string }[];
};

export const lobbyVenues: LobbyVenue[] = [
  {
    id: "dupion",
    name: "Dupion",
    logo: logoDupion,
    logoHeight: 53,
    note: "Cocktail room",
    cuisine: "Cocktails · Small Plates",
    area: "Jawahar Circle",
    address: "1st floor, Taffeta Coffee, Jawahar Circle",
    instagramUrl: "https://www.instagram.com/dupion.jaipur/",
    instagramHandle: "@dupion.jaipur",
    photo: {
      image: dupionBar,
      alt: "The Dupion cocktail bar, glowing bottles and crystal chandelier",
      focus: "center 50%",
    },
    menus: [
      { label: "Food", note: "The kitchen", icon: "food", href: "/dupion-menu.pdf" },
      { label: "Cocktails", note: "The bar list", icon: "cocktails", href: "/dupion-cocktails.pdf" },
      { label: "Spirits & Wine", note: "Pours by the glass and bottle", icon: "spirits", href: "/dupion-spirits.pdf" },
    ],
    mapsUrl: "https://maps.google.com/?q=Dupion+Cocktail+Room+Taffeta+Coffee+Jawahar+Circle+Jaipur",
    gallery: [
      { image: dupion1, alt: "The Dupion cocktail bar with glowing backbar bottles and crystal chandelier" },
      { image: dupion2, alt: "Intimate speakeasy cocktail lounge with plush velvet seating" },
      { image: dupion3, alt: "Moody backlit spirit shelves and warm marble bar counter" },
      { image: dupion4, alt: "Polished marble bar top and crystal glassware reflections" },
      { image: dupion5, alt: "Clarified Silk Route cocktail in crystal coupe with stamped ice block and gold flake" },
      { image: dupion6, alt: "Smoked Old Fashioned under glass cloche with swirling aromatic smoke" },
      { image: dupion7, alt: "Gourmet torched salmon dragon roll sushi on dark slate plate" },
      { image: dupion8, alt: "Signature Khubani Noor Tres Leches dessert with apricot glaze and edible silver" },
      { image: dupion9, alt: "Mixologist pouring house infusion from copper beaker with fine strainer" },
      { image: dupion10, alt: "Botanical highball cocktail with shiso leaf, yuzu zest, and clear ice spear" },
      { image: dupion11, alt: "Curated cocktail flight and artisanal crystal glassware" },
      { image: dupion12, alt: "Dimly lit velvet booth corner for intimate evening conversations" },
      { image: dupion13, alt: "Truffle glazed artisanal flatbread pizza with shaved parmesan" },
      { image: dupion14, alt: "Gourmet brioche slider trio on dark stoneware plate" },
      { image: dupion15, alt: "House-made spiced botanical infusions and crystal decanters" },
      { image: dupion16, alt: "Charred yakitori skewers fresh off the robata grill" },
      { image: dupion17, alt: "Late-night speakeasy atmosphere under warm amber sconce lights" },
      { image: dupion18, alt: "Private tasting alcove with leather armchairs and cocktail library" },
    ],
  },
  {
    id: "lazymojo",
    name: "LazyMojo",
    logo: logoLazymojo,
    logoHeight: 70,
    note: "All-day café, bakery & banquet",
    cuisine: "Café · Bakery · Continental",
    area: "Malviya Nagar",
    address: "H1, H2, SL Marg, opp. Genpact Jaipur, Lal Bahadur Nagar, Malviya Nagar, Jaipur, Rajasthan 302018",
    instagramUrl: "https://www.instagram.com/cafelazymojo/",
    instagramHandle: "@cafelazymojo",
    photo: {
      image: lazymojoDark,
      alt: "Cafe LazyMojo illuminated storefront and entrance",
      focus: "center 50%",
    },
    menu: "/lazymojo-menu.pdf",
    mapsUrl: "https://maps.google.com/?q=Cafe+LazyMojo+SL+Marg+Malviya+Nagar+Jaipur",
    gallery: [
      { image: lazymojoG1, alt: "Cafe LazyMojo illuminated storefront and marquee night facade" },
      { image: lazymojoG2, alt: "Welcoming cafe entrance and lush outdoor porch in daylight" },
      { image: lazymojoG3, alt: "Iconic street facade of Cafe LazyMojo, Malviya Nagar" },
      { image: lazymojoG4, alt: "Sunlit main dining hall with panoramic picture windows" },
      { image: lazymojoG5, alt: "Vibrant tiled verandah and breezy balcony seating" },
      { image: lazymojoG6, alt: "Cozy wooden booth seating under decorative pendant lamps" },
      { image: lazymojoG7, alt: "Artistic chalkboard mural and warm cafe interior" },
      { image: lazymojoG8, alt: "Main dining room with modern wooden furniture and ambient lighting" },
      { image: lazymojoG9, alt: "Cafe seating corner surrounded by indoor greenery and planters" },
      { image: lazymojoG10, alt: "Lush green cafe corner with natural daylight" },
      { image: lazymojoG11, alt: "Comfortable sofa seating nook for relaxed cafe gatherings" },
      { image: lazymojoG12, alt: "Verandah table setting with views of the bustling street below" },
      { image: lazymojoG13, alt: "Cozy dining booths with warm wooden textures" },
      { image: lazymojoG14, alt: "Signature wood-fired pizza with bubbling mozzarella and fresh toppings" },
      { image: lazymojoG15, alt: "Creamy penne pasta in rich herb sauce with garlic sourdough toast" },
      { image: lazymojoG16, alt: "Signature Belgian chocolate shake and iced cold coffee" },
      { image: lazymojoG17, alt: "Gourmet towering cheese burger served with crispy golden fries" },
      { image: lazymojoG18, alt: "Artisanal bakery showcase with fresh pastries and decadent cakes" },
      { image: lazymojoG19, alt: "Loaded melted cheese fries topped with herbs and dipping sauces" },
      { image: lazymojoG20, alt: "Sizzling hot multi-cuisine platter served fresh from the kitchen" },
    ],
  },
  {
    id: "magnolia",
    name: "Magnolia",
    logo: logoMagnolia,
    logoHeight: 61,
    note: "Open-air garden dining under the trees",
    cuisine: "Italian · Mediterranean · Continental",
    area: "Smriti Van, Malviya Nagar",
    address: "Garden Theatre, JLN Marg, Near Smriti Van, Malviya Nagar",
    instagramUrl: "https://www.instagram.com/themagnoliajaipur/",
    instagramHandle: "@themagnoliajaipur",
    photo: {
      image: magEntrance,
      alt: "The Magnolia entrance courtyard and illuminated gardens",
      focus: "center 50%",
    },
    menu: "/magnolia-menu.pdf",
    mapsUrl: "https://maps.google.com/?q=The+Magnolia+Garden+Theatre+Smriti+Van+JLN+Marg+Jaipur",
    gallery: [
      { image: magnoliaG1, alt: "The Magnolia entrance courtyard and illuminated forest terrace" },
      { image: magnoliaG2, alt: "Open-air forest dining courtyard under ancient canopy trees" },
      { image: magnoliaG3, alt: "Illuminated stone entryway nestled inside Smriti Van nature park" },
      { image: magnoliaG4, alt: "Rustic wooden pergola terrace seating with botanical views" },
      { image: magnoliaG5, alt: "Serene forest pavilion cafe amidst lush green foliage" },
      { image: magnoliaG6, alt: "Amphitheater garden seating area surrounded by nature" },
      { image: magnoliaG7, alt: "Open-air wooden deck tables under dense forest canopy" },
      { image: magnoliaG8, alt: "Conservatory glasshouse dining nook filled with morning light" },
      { image: magnoliaG9, alt: "Enchanting evening dining ambiance with fairy lights in the trees" },
      { image: magnoliaG10, alt: "Garden theatre stone courtyard and outdoor dining tables" },
      { image: magnoliaG11, alt: "Artisanal wood-fired thin-crust Margherita pizza with fresh basil" },
      { image: magnoliaG12, alt: "Mediterranean mezze platter with creamy hummus, olives, and warm pita" },
      { image: magnoliaG13, alt: "Vibrant botanical garden salad bowl with lemon herb vinaigrette" },
      { image: magnoliaG14, alt: "Handcrafted iced matcha latte and cold brew on rustic wooden table" },
      { image: magnoliaG15, alt: "Smashed avocado and heirloom tomato tartine on country sourdough" },
      { image: magnoliaG16, alt: "Decadent dark chocolate truffle cake slice and fresh berry tart" },
      { image: magnoliaG17, alt: "Sunlight filtering through the Smriti Van tree canopy onto open-air deck" },
      { image: magnoliaG18, alt: "Terracotta planter walkway leading into the tranquil dining garden" },
    ],
  },
  {
    id: "chaat",
    name: "Chaat 'n' Chutneys",
    logo: logoChaat,
    logoHeight: 111,
    note: "Pure-veg street food, plated fresh",
    cuisine: "Indian street food · North & South Indian",
    area: "Aldhara JDA, Malviya Nagar",
    address: "Aldhara JDA, JLN Marg, Malviya Nagar",
    instagramUrl: "https://www.instagram.com/chaatnchutneysjaipur/",
    instagramHandle: "@chaatnchutneysjaipur",
    strip: [
      { image: chaatShot1, alt: "The stand on Bajaj Nagar", focus: "45% 50%" },
      { image: chaatShot2, alt: "Booth seating, tiled floor", focus: "center" },
      { image: chaatShot3, alt: "Vada pav and cutting chai", focus: "center" },
    ],
    menu: "/chaat-menu.pdf",
    mapsUrl: "https://maps.google.com/?q=Chaat+n+Chutneys+Jaldhara+JDA+JLN+Marg+Malviya+Nagar+Jaipur",
    gallery: [
      { image: chaatG1, alt: "Chaat n Chutneys vibrant storefront on Bajaj Nagar / JLN Marg" },
      { image: chaatG2, alt: "Modern and hygienic dining room with patterned tile booths" },
      { image: chaatG3, alt: "Steaming cutting chai and Mumbai vada pav served hot" },
      { image: chaatG4, alt: "Signature plated pure-vegetarian chaat platter with fresh chutneys" },
      { image: chaatG5, alt: "Main dining hall with warm terracotta accents and welcoming atmosphere" },
      { image: chaatG6, alt: "Live interactive chaat counter with fresh crisp ingredients" },
      { image: chaatG7, alt: "Royal Raj Kachori overflowing with sweet curd, chutneys, sev, and pomegranate" },
      { image: chaatG8, alt: "Crisp Pani Puri platter with spicy mint and sweet tamarind water shots" },
      { image: chaatG9, alt: "Dahi Puri platter topped with chilled whipped curd and fresh mint chutney" },
      { image: chaatG10, alt: "Crispy Samosa Chaat with spiced chickpea chole and chopped onions" },
      { image: chaatG11, alt: "Hot buttery Pav Bhaji with spiced vegetable mash and toasted golden pav" },
      { image: chaatG12, alt: "Golden crispy paper-thin Masala Dosa with coconut chutney and hot sambar" },
      { image: chaatG13, alt: "Fluffy golden Chole Bhature with Punjabi chickpea curry and pickled onions" },
      { image: chaatG14, alt: "Steaming hot Masala Cutting Chai served in rustic clay kulhads" },
      { image: chaatG15, alt: "Freshly fried golden spiral Jalebis served with rich pistachio Rabri" },
      { image: chaatG16, alt: "Papdi Chaat layered with spiced potatoes, curd, and tangy sauces" },
      { image: chaatG17, alt: "Sev Puri garnished with crunchy nylon sev and fresh coriander" },
      { image: chaatG18, alt: "South Indian filter coffee poured in traditional brass tumbler" },
    ],
  },
];
