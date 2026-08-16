// Deterministic host — used when GEMINI_API_KEY is unset or the model errors.
// It can't converse like the model, but it's never wrong and never off-menu:
// it reads the latest message, matches intent + menu filters, and answers from
// real data. This keeps /chat useful when there's no key configured.
//
// Matching is word-boundary based, NOT substring: naive `includes("hi")` also
// fires on "c-hi-cken" and `includes("veg")` on "beverage", which silently
// routes real questions to the wrong answer.

import { business, location } from "@/lib/content";
import {
  menu,
  menuById,
  currency,
  dietaryMarkedCategories,
  addOns,
  specials,
  type MenuItem,
} from "./menu";
import { daypart } from "./prompt";

const money = (m: MenuItem) => `${currency}${m.price}`;
const line = (m: MenuItem) => `• ${m.name} — ${money(m)}${m.desc ? ` · ${m.desc}` : ""}`;

const COFFEE_CATEGORIES = [
  "Hot Black Coffee", "Hot White Coffee", "Iced White Coffee",
  "Coffee With Populars", "Manual Brew Coffee", "Cold Brew Coffee",
];
const COLD_COFFEE_CATEGORIES = ["Iced White Coffee", "Cold Brew Coffee", "Frappe"];
const HOT_COFFEE_CATEGORIES = ["Hot Black Coffee", "Hot White Coffee"];
const DESSERT_CATEGORIES = ["Cookies & Dry Cakes", "Patisserie", "Viennoiseries", "Indulgent Tubs"];
const LIGHTER_CATEGORIES = ["Salads", "Smoothies", "Cold Bowls", "Sides"];
const NO_CAFFEINE_CATEGORIES = ["Coolers", "Non-Caffeine", "Smoothies", "Shakes"];

// Words carrying no menu signal — dropped before keyword search so that
// "bhai kuch pistachio wala batao" searches on "pistachio" alone.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "without", "any", "some", "something", "anything",
  "what", "whats", "which", "who", "how", "can", "could", "would", "should",
  "want", "need", "have", "has", "get", "give", "show", "tell", "like", "about",
  "you", "your", "our", "his", "her", "its", "this", "that", "these", "those",
  "there", "here", "please", "thanks", "order", "menu", "item", "items", "one",
  // common Hinglish filler
  "kuch", "hai", "hain", "mein", "kya", "batao", "bata", "chahiye", "dedo",
  "yaar", "bhai", "bro", "acha", "achha", "koi", "wala", "wali", "sab", "aur",
]);

function pick(list: MenuItem[], n: number): MenuItem[] {
  return list.filter((m) => m.available).slice(0, n);
}

// Word-boundary test, so "veg" doesn't fire inside "beverage".
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function budget(text: string): number | null {
  const m = text.match(
    /(?:under|below|less than|upto|up to|within|andar|niche|₹|rs\.?)\s*₹?\s*(\d{2,4})/i
  );
  return m ? Number(m[1]) : null;
}

// Free-text menu search: "pistachio", "biscoff", "chicken", "paneer", "matcha".
// Scores every item by how many query words appear in its name/description,
// weighting a name hit higher than a description hit.
// Light stem so "chocolatey"→"chocolat", "cheesy"→"chees", "berries"→"berri"
// all still hit the item names ("chocolate", "cheese", "berry").
function stem(w: string): string {
  return w.length >= 5 ? w.replace(/(?:ey|ies|es|y|s)$/, "") : w;
}
function search(text: string): MenuItem[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];

  const hit = (hay: string, w: string): boolean => {
    const st = stem(w);
    return hay.includes(w) || (st.length >= 4 && hay.includes(st));
  };

  const scored = menu
    .filter((m) => m.available)
    .map((m) => {
      const name = m.name.toLowerCase();
      const desc = (m.desc ?? "").toLowerCase();
      let score = 0;
      for (const w of words) {
        if (hit(name, w)) score += 3;
        else if (hit(desc, w)) score += 1;
      }
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.m);
}

export function fallbackReply(userText: string): string {
  const t = userText.toLowerCase().trim();
  const has = (...w: string[]) => w.some((x) => hasWord(t, x));
  const cap = budget(t);

  // Every menu answer routes through here so a budget mentioned anywhere in
  // the question ("cold coffee under 250") narrows whatever we matched.
  const reply = (intro: string, items: MenuItem[]): string => {
    const withinBudget = cap ? items.filter((m) => m.price <= cap) : items;
    const chosen = pick(withinBudget, 3);
    if (chosen.length === 0) {
      return cap
        ? `I couldn't find that at ${currency}${cap} or under. Tell me a little more about what you're after and I'll find the closest thing — or the team can help you pick.`
        : "I'll confirm that with the team — I want to make sure I get it right for you.";
    }
    const head = cap ? `${intro.replace(/:$/, "")} at ${currency}${cap} or under:` : intro;
    return `${head}\n${chosen.map(line).join("\n")}`;
  };

  // ————— quick service requests (instant, reliable)
  if (has("waiter", "server", "steward"))
    return "Of course — I've let the team know, someone will be right with you. 🙌";
  if (has("water", "paani"))
    return "On its way — I've asked the team to bring water to your table.";
  if (has("tissue", "tissues", "napkin", "napkins"))
    return "Sure — tissues are on the way to your table.";
  if (has("bill", "cheque", "checkout") || /check,? please/i.test(t))
    return "Absolutely — I've let the team know you'd like the bill. It'll be with you shortly.";
  if (has("wifi", "wi-fi", "internet", "password"))
    return "We've got free guest WiFi 🙂 — tap the “WiFi” button on the home screen and verify your number, and you'll be connected in seconds.";

  // ————— ordering / payment: this chat can't do either, so never imply it can
  if (has("cart", "pay", "payment", "upi", "checkout") || /place (my |the )?order/i.test(t))
    return "I can help you decide, but I can't place the order or take payment here — tell your server what you'd like, or use the QR code on your table to order. Want a recommendation first?";

  // ————— reservations / events
  if (has("book", "booking", "reserve", "reservation", "birthday", "anniversary", "event", "party") || /table for/i.test(t))
    return `I'd love to help with that. Share your name, number of guests, date, time and the occasion, and our team will confirm. You can also WhatsApp us on ${location.phoneDisplay}.`;

  // ————— hours / location
  if (has("open", "hours", "timing", "timings", "close", "closing"))
    return `We're open ${location.hours[0].days} ${location.hours[0].time}, and ${location.hours[1].days} ${location.hours[1].time}. We're at ${location.address}.`;
  if (has("where", "location", "address", "directions", "parking"))
    return `We're at ${location.address}, with on-site parking. Want me to help you plan a visit?`;

  // ————— founders, history & brand story
  if (has("owner", "owners", "founder", "founders", "aziz", "shokat", "panwar", "heritage")) {
    return "Taffeta Coffee is founded and owned by Aziz Panwar and Shokat Panwar, culinary hospitality pioneers in Jaipur with over 25 years of industry excellence. Their iconic establishments in Jaipur include Cafe LazyMojo, The Magnolia (Garden Theatre), Dupion Cocktail Room, Chaat 'n' Chutneys, and LazyMojo Banquet. ☕✨";
  }
  if (has("story", "history", "modbar", "roastery", "debut", "launch", "largest")) {
    return "Officially launched in March 2025 on JLN Marg (3 mins from Jaipur Airport), Taffeta Coffee is North India's largest coffee house. It features North India's first interactive Modbar brewing counter (zero-barrier below-counter brewing) and an award-winning in-house specialty roastery recognized among India's finest. ☕✨";
  }

  // ————— Taffeta specials / chef's recommendation
  if (has("special", "specials", "signature", "chef", "chefs", "recommendation") || /chef.?s/i.test(t) || /what.?s good/i.test(t)) {
    const parts = specials.groups.map((g) => {
      const items = g.ids
        .map((id) => menuById.get(id))
        .filter((m): m is MenuItem => Boolean(m))
        .map((m) => `• ${m.name} — ${money(m)}`);
      return `${g.label}:\n${items.join("\n")}`;
    });
    return (
      "Taffeta's specials — our chef's picks ☕\n" +
      parts.join("\n") +
      `\n\nAlso worth trying: ${specials.offMenu.join(", ")} — do ask the Order Taker for the details on those.`
    );
  }

  // ————— customization (the printed Add Ons panel)
  if (has("decaf", "oat", "almond milk", "soya", "soy", "lactose", "add on", "addon", "add-on", "customise", "customize", "syrup")) {
    const list = (arr: { name: string; price: number }[]) =>
      arr.map((a) => `${a.name}${a.price ? ` +${currency}${a.price}` : ""}`).join(" · ");
    return [
      "On our coffees you can customise:",
      `• Blend — ${list(addOns.blend)}`,
      `• Milk — ${list(addOns.milk)}`,
      `• Flavour — ${list(addOns.flavor)}`,
      "Add-on charges are on top of the drink price. Do confirm with the team for a specific drink.",
    ].join("\n");
  }

  // ————— facts the printed menu simply does not carry. Answering "is X
  // sugar-free?" with a guess is the exact failure this whole file exists to
  // prevent — so name the gap, then give what we DO have: the description.
  if (has("sugar", "sugarfree", "calorie", "calories", "kcal", "protein", "carbs", "carb", "fat", "nutrition", "nutritional", "keto")) {
    const named = search(t)[0];
    const detail = named
      ? ` For the ${named.name}, what the menu does list is: ${(named.desc ?? `${currency}${named.price}`).replace(/\.$/, "")}.`
      : "";
    return `Our menu doesn't print sugar, calorie or other nutrition information, so I'd rather not guess.${detail} The team can check the specifics for you.`;
  }

  // ————— dietary — grounded strictly in what Taffeta's menu actually marks
  if (has("jain"))
    return "Our menu doesn't carry Jain marking, so I don't want to guess and get it wrong. Please check with the team and they'll help you pick safely.";
  if (has("vegan"))
    return reply('Here\'s what our menu names as vegan:', menu.filter((m) => /\bvegan\b/i.test(m.name)));
  if (has("gluten", "celiac", "coeliac"))
    return reply(
      "These aren't flagged for gluten on our food menu (not a certified gluten-free claim — please confirm with the team):",
      menu.filter((m) => dietaryMarkedCategories.includes(m.category) && !m.allergens?.includes("gluten"))
    );
  if (has("nuts", "nut", "peanut", "peanuts", "allergy", "allergic"))
    return (
      reply(
        "Within our food menu, these aren't flagged for nuts (drinks, cookies and pastries aren't allergen-marked at all, so I can't confirm those):",
        menu.filter((m) => dietaryMarkedCategories.includes(m.category) && !m.allergens?.includes("nuts"))
      ) + "\n\nPlease do tell the team about your allergy when you order — they'll confirm properly."
    );
  if (has("egg", "eggs", "eggless"))
    return reply(
      "These food items aren't flagged for egg on the menu:",
      menu.filter((m) => dietaryMarkedCategories.includes(m.category) && !m.allergens?.includes("egg"))
    );
  if (has("dairy", "milk free", "lactose free"))
    return reply(
      "These food items aren't flagged for dairy (for drinks, we do offer lactose-free, soya, oat and almond milk as add-ons):",
      menu.filter((m) => dietaryMarkedCategories.includes(m.category) && !m.allergens?.includes("dairy"))
    );
  // A named protein ("chicken", "paneer") is a search, not a diet filter —
  // routing it to the whole non-veg list answers with pancakes.
  if (has("non veg", "non-veg", "nonveg", "meat"))
    return reply("Here are non-veg options:", menu.filter((m) => !m.veg));
  // "veg mein kya hai" wants food, not the (trivially vegetarian) drinks list.
  if (has("veg", "veggie", "vegetarian")) {
    const food = menu.filter((m) => m.veg && dietaryMarkedCategories.includes(m.category));
    return reply("Here are vegetarian favourites:", food.length ? food : menu.filter((m) => m.veg));
  }

  // ————— drinks by temperature / caffeine
  if (has("cold coffee", "iced coffee") || (has("cold", "iced", "thanda") && has("coffee")))
    return reply("Cold coffee options:", menu.filter((m) => COLD_COFFEE_CATEGORIES.includes(m.category)));
  if (has("hot coffee") || (has("hot", "garam") && has("coffee")))
    return reply("Hot coffee options:", menu.filter((m) => HOT_COFFEE_CATEGORIES.includes(m.category)));
  if (has("caffeine", "decaffeinated") || /without coffee|no coffee|non caffeine/i.test(t))
    return reply(
      "Refreshing, without coffee:",
      menu.filter((m) => NO_CAFFEINE_CATEGORIES.includes(m.category))
    );

  // ————— preferences
  if (has("spicy", "spice", "teekha", "tikha"))
    return reply(
      "We don't print a spice scale, but these are described as chilli/harissa/masala-forward:",
      menu.filter((m) => /chilli|harissa|jalape|peri|masala|spiced|chili/i.test(m.name + " " + (m.desc ?? "")))
    );
  if (has("sweet", "dessert", "desserts", "cake", "mitha", "meetha"))
    return reply("For something sweet:", menu.filter((m) => DESSERT_CATEGORIES.includes(m.category)));
  if (has("healthy", "diet", "light", "salad"))
    return reply("Lighter options:", menu.filter((m) => LIGHTER_CATEGORIES.includes(m.category)));
  if (has("filling", "heavy", "hungry", "bhookh", "bhook"))
    return reply(
      "Something more filling:",
      menu.filter((m) => ["Burgers & Bagels", "Artisan Pizza", "Pasta", "Plates & Bowls"].includes(m.category))
    );
  if (has("coffee", "espresso", "latte", "cappuccino"))
    return reply("From the coffee menu:", menu.filter((m) => COFFEE_CATEGORIES.includes(m.category)));

  // ————— free-text search: ingredients, dish names, categories
  const found = search(t);
  if (found.length > 0) return reply("Here's what I found:", found);

  // ————— budget with no other signal
  if (cap) return reply(`Options`, menu);

  // ————— recommend / greeting
  if (has("recommend", "recommendation", "suggest", "suggestion", "best", "popular", "famous") || /what should/i.test(t)) {
    const spread = [
      menu.find((m) => COFFEE_CATEGORIES.includes(m.category) && m.available),
      menu.find((m) => m.category === "All Day Breakfast" && m.available),
      menu.find((m) => DESSERT_CATEGORIES.includes(m.category) && m.available),
    ].filter((m): m is MenuItem => Boolean(m));
    return reply("A few different directions to start:", spread);
  }
  if (/^(hi+|hey+|hello+|yo|namaste|hola|start|good (morning|afternoon|evening))\b/i.test(t))
    return `Welcome to ${business.name}! ☕ ${greeting()} You can ask me for recommendations, veg/non-veg or allergen-aware options, prices, the WiFi, or to book a table — how can I help?`;

  // ————— graceful default
  return `Happy to help! I can recommend dishes and drinks, filter for veg/non-veg or known allergens, find something within your budget, or help you book a table. What are you in the mood for?`;
}

function greeting(): string {
  return {
    morning: "A fresh coffee to start the day?",
    lunch: "Something quick and satisfying?",
    evening: "In the mood for something special this evening?",
    late: "A little something to round off the night?",
  }[daypart(new Date())];
}
