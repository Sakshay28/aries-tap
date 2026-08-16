// The menu knowledge base — the AI Host's single source of truth. The model
// may only recommend items that exist here; it can never invent a dish, a
// price, or an ingredient (the system prompt enforces this, and the prompt is
// built ONLY from this data). One venue = one menu; an owner swaps this file
// the same way they swap the rest of content.ts.
//
// Every item, price, description and dietary/allergen mark below is
// transcribed directly from Taffeta Coffee's real printed menu
// (`menu41763964323868.pdf`, pages 2–8) — read at 400dpi per page to confirm
// the small veg/non-veg + allergen icons rather than guess at them. Fields
// the physical menu does NOT provide (calories, spice level, prep time, Jain
// status, "bestseller"/"chef pick" claims) are deliberately absent rather
// than invented — a menu-grounded AI is only as honest as this file.
//
// Dietary icons only appear on the food pages (All Day Breakfast → Pasta,
// see `dietaryMarkedCategories`). Drinks, cookies, patisserie, viennoiseries
// and indulgent tubs carry NO veg/non-veg or allergen icons on the physical
// menu — they're marked `veg: true` here only because a coffee/pastry menu
// contains no meat/fish by category (a menu-level fact, not a per-item
// claim), and their `allergens` are left undefined ("not marked" — never
// treat as "allergen-free"). See HARD RULES in prompt.ts for how the model
// must talk about this gap.

export type Allergen = "gluten" | "dairy" | "nuts" | "egg";

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number; // ₹, as printed
  desc?: string; // guest-facing line, ONLY when the menu prints one — never backfilled
  veg: boolean; // true = vegetarian, false = non-vegetarian, per Taffeta's own printed icon (their convention marks most egg dishes non-veg — verified per item, not assumed)
  allergens?: Allergen[]; // ONLY the icons Taffeta prints for this item. Undefined ≠ allergen-free — see dietaryMarkedCategories.
  available: boolean; // an owner can 86 an item without deleting it
};

export const currency = "₹";

// The physical menu prints no tax rate or service-charge line anywhere in
// its 8 pages — so unlike a hand-authored placeholder, this makes no claim
// about GST. The model should only ever say prices are pre-bill.
export const taxNote = "Prices shown are as printed on the menu; final bill may include tax/service charge.";

// Categories where Taffeta prints the veg (green) / non-veg (maroon) square
// AND allergen icons (gluten/dairy/nuts/egg) next to each item. Outside this
// list (all drinks, cookies, patisserie, viennoiseries, indulgent tubs) the
// menu prints no allergen icons at all — the model must say so, not guess.
export const dietaryMarkedCategories = [
  "All Day Breakfast",
  "Sandwiches",
  "Salads",
  "Sides",
  "Wraps",
  "Burgers & Bagels",
  "Cold Bowls",
  "Plates & Bowls",
  "Smoothies",
  "Artisan Pizza",
  "Pasta",
];

// The printed "Add Ons" panel (blend / milk / flavor) sits under the coffee
// program. These are the categories where that customization plausibly
// applies — the system prompt still tells the model to confirm per item
// rather than assume every drink takes every add-on.
export const addOnEligibleCategories = [
  "Hot Black Coffee",
  "Hot White Coffee",
  "Iced White Coffee",
  "Coffee With Populars",
  "Manual Brew Coffee",
  "Cold Brew Coffee",
];

export type AddOn = { name: string; price: number };

export const addOns: { blend: AddOn[]; milk: AddOn[]; flavor: AddOn[] } = {
  blend: [
    { name: "House Blend", price: 0 },
    { name: "Brandy Barrel", price: 20 },
    { name: "Ratnagiri Single Origin", price: 30 },
    { name: "Decaf", price: 60 },
  ],
  milk: [
    { name: "Lactose Free", price: 60 },
    { name: "Soya Milk", price: 60 },
    { name: "Oat Milk", price: 80 },
    { name: "Almond Milk", price: 100 },
  ],
  flavor: [
    { name: "Hazelnut", price: 25 },
    { name: "Irish", price: 25 },
    { name: "Tiramisu", price: 25 },
    { name: "Vanilla", price: 25 },
    { name: "Caramel", price: 25 },
  ],
};

export const menu: MenuItem[] = [
  // ————————————————————————————— Hot Black Coffee
  { id: "americano", name: "Americano", category: "Hot Black Coffee", price: 175, desc: "Double espresso extracted over hot water. Serving size: 150 ml.", veg: true, available: true },
  { id: "espresso", name: "Espresso", category: "Hot Black Coffee", price: 165, desc: "Double shot of house blend espresso roast. Serving size: 40 ml.", veg: true, available: true },
  { id: "irish-coffee", name: "Irish Coffee", category: "Hot Black Coffee", price: 195, veg: true, available: true },

  // ————————————————————————————— Hot White Coffee
  { id: "cafe-macchiato", name: "Cafe Macchiato", category: "Hot White Coffee", price: 175, desc: "Double espresso with a foamed milk. Serving size: 60 ml.", veg: true, available: true },
  { id: "cafe-mocha", name: "Cafe Mocha", category: "Hot White Coffee", price: 235, desc: "Espresso, cocoa powder, steamed milk. Serving size: 190 ml.", veg: true, available: true },
  { id: "cortado", name: "Cortado", category: "Hot White Coffee", price: 195, desc: "Double espresso with equal milk and foam. Serving size: 100 ml.", veg: true, available: true },
  { id: "pistachio-latte", name: "Pistachio Latte", category: "Hot White Coffee", price: 310, desc: "Double espresso with equal milk and foam. Serving size: 100 ml.", veg: true, available: true },
  { id: "biscoff-latte", name: "Biscoff Latte", category: "Hot White Coffee", price: 245, desc: "Espresso, Biscoff, steamed milk. Serving size: 220 ml.", veg: true, available: true },
  { id: "piccolo-latte", name: "Piccolo Latte", category: "Hot White Coffee", price: 225, desc: "Espresso, steamed milk, microfoam. Serving size: 100 ml.", veg: true, available: true },
  { id: "cappuccino", name: "Cappuccino", category: "Hot White Coffee", price: 200, desc: "Espresso, steamed milk, 1/3rd foam, served warm at 65°C. Serving size: 190 ml.", veg: true, available: true },
  { id: "flat-white", name: "Flat White", category: "Hot White Coffee", price: 210, desc: "Double espresso, steamed milk, microfoam. Serving size: 200 ml.", veg: true, available: true },
  { id: "cardamom-spiced-latte", name: "Cardamom Spiced Latte", category: "Hot White Coffee", price: 215, desc: "Double espresso, steamed milk. Serving size: 200 ml.", veg: true, available: true },
  { id: "cafe-latte", name: "Cafe Latte", category: "Hot White Coffee", price: 200, desc: "Espresso, steamed milk, microfoam. Serving size: 220 ml.", veg: true, available: true },

  // ————————————————————————————— Iced White Coffee
  { id: "iced-latte", name: "Iced Latte", category: "Iced White Coffee", price: 220, desc: "Double espresso with ice & milk. Serving size: 200 ml.", veg: true, available: true },
  { id: "brown-butter-latte", name: "Brown Butter Latte", category: "Iced White Coffee", price: 240, desc: "Double shot of house blend espresso roast. Serving size: 40 ml.", veg: true, available: true },
  { id: "spanish-iced-latte", name: "Spanish Iced Latte", category: "Iced White Coffee", price: 245, veg: true, available: true },
  { id: "iced-mocha", name: "Iced Mocha", category: "Iced White Coffee", price: 240, desc: "Espresso, cocoa powder, milk, topped with ice. Serving size: 190 ml.", veg: true, available: true },
  { id: "pistachio-iced-latte", name: "Pistachio Iced Latte", category: "Iced White Coffee", price: 310, veg: true, available: true },
  { id: "affogato", name: "Affogato", category: "Iced White Coffee", price: 235, desc: "Espresso over ice cream. Serving size: 40 ml + 2 scoops ice cream.", veg: true, available: true },
  { id: "peanut-butter-iced-latte", name: "Peanut Butter Iced Latte", category: "Iced White Coffee", price: 245, veg: true, available: true },
  { id: "gulf-iced-latte", name: "Gulf Iced Latte", category: "Iced White Coffee", price: 290, veg: true, available: true },
  { id: "salted-caramel-iced-latte", name: "Salted Caramel Iced Latte", category: "Iced White Coffee", price: 245, veg: true, available: true },
  { id: "strawberry-freddo", name: "Strawberry Freddo", category: "Iced White Coffee", price: 245, veg: true, available: true },

  // ————————————————————————————— Coffee With Populars
  { id: "sunshine", name: "Sunshine", category: "Coffee With Populars", price: 255, desc: "Espresso with orange juice & tonic.", veg: true, available: true },
  { id: "iced-americano", name: "Iced Americano", category: "Coffee With Populars", price: 175, desc: "Double shot espresso with ice & water.", veg: true, available: true },
  { id: "coffee-tonic", name: "Coffee Tonic", category: "Coffee With Populars", price: 255, desc: "Espresso with tonic water.", veg: true, available: true },
  { id: "coffee-cran", name: "Coffee Cran", category: "Coffee With Populars", price: 255, desc: "Espresso with cranberry juice.", veg: true, available: true },

  // ————————————————————————————— Manual Brew Coffee
  { id: "vietnamese", name: "Vietnamese", category: "Manual Brew Coffee", price: 295, veg: true, available: true },
  { id: "aeropress", name: "Aeropress", category: "Manual Brew Coffee", price: 230, veg: true, available: true },
  { id: "v60-pour-over", name: "V60 Pour Over", category: "Manual Brew Coffee", price: 230, veg: true, available: true },
  { id: "chemex", name: "Chemex", category: "Manual Brew Coffee", price: 230, veg: true, available: true },
  { id: "french-press", name: "French Press", category: "Manual Brew Coffee", price: 240, veg: true, available: true },

  // ————————————————————————————— Cold Brew Coffee
  { id: "taffeta-cold-brew", name: "Taffeta Cold Brew (Single Origin)", category: "Cold Brew Coffee", price: 255, veg: true, available: true },
  { id: "nitro-cold-brew", name: "Nitro Cold Brew (Drippen Process Infused With Nitro)", category: "Cold Brew Coffee", price: 255, veg: true, available: true },
  { id: "classic-cold-brew", name: "Classic Cold Brew (House Blend)", category: "Cold Brew Coffee", price: 245, veg: true, available: true },

  // ————————————————————————————— Japanese Matcha
  { id: "mango-matcha-iced", name: "Mango Matcha Iced", category: "Japanese Matcha", price: 290, veg: true, available: true },
  { id: "iced-matcha-latte", name: "Iced Matcha Latte", category: "Japanese Matcha", price: 260, veg: true, available: true },
  { id: "yakult-iced-matcha", name: "Yakult Iced Matcha", category: "Japanese Matcha", price: 260, veg: true, available: true },
  { id: "strawberry-matcha-iced", name: "Strawberry Matcha Iced", category: "Japanese Matcha", price: 290, veg: true, available: true },
  { id: "rose-iced-matcha", name: "Rose Iced Matcha", category: "Japanese Matcha", price: 260, veg: true, available: true },

  // ————————————————————————————— Shakes
  { id: "taffeta-apricot", name: "Taffeta Apricot", category: "Shakes", price: 290, veg: true, available: true },
  { id: "banana-caramel", name: "Banana Caramel", category: "Shakes", price: 260, veg: true, available: true },
  { id: "biscoff-shake", name: "Biscoff Shake", category: "Shakes", price: 280, veg: true, available: true },
  { id: "chocolate-peanut-butter-shake", name: "Chocolate Peanut Butter Shake", category: "Shakes", price: 260, veg: true, available: true },
  { id: "fresh-strawberry-shake", name: "Fresh Strawberry Shake", category: "Shakes", price: 260, veg: true, available: true },
  { id: "belgium-chocolate-shake", name: "Belgium Chocolate", category: "Shakes", price: 280, veg: true, available: true },

  // ————————————————————————————— Frappe
  { id: "classic-frappe", name: "Classic Frappe", category: "Frappe", price: 230, veg: true, available: true },
  { id: "mocha-frappe", name: "Mocha Frappe", category: "Frappe", price: 240, veg: true, available: true },
  { id: "biscoff-cloud-coffee", name: "Biscoff Cloud Coffee", category: "Frappe", price: 240, veg: true, available: true },

  // ————————————————————————————— Coolers
  { id: "strawberry-mocktail", name: "Strawberry Mocktail", category: "Coolers", price: 230, veg: true, available: true },
  { id: "mint-mojito", name: "Mint Mojito", category: "Coolers", price: 230, veg: true, available: true },
  { id: "lemon-iced-tea", name: "Lemon Iced Tea", category: "Coolers", price: 220, veg: true, available: true },
  { id: "passion-fruit-bonanza", name: "Passion Fruit Bonanza", category: "Coolers", price: 230, veg: true, available: true },

  // ————————————————————————————— Non-Caffeine
  { id: "belgium-hot-chocolate", name: "Belgium Hot Chocolate", category: "Non-Caffeine", price: 290, veg: true, available: true },
  { id: "chai-latte", name: "Chai Latte", category: "Non-Caffeine", price: 210, veg: true, available: true },
  { id: "turmeric-latte", name: "Turmeric Latte", category: "Non-Caffeine", price: 210, veg: true, available: true },

  // ————————————————————————————— Hot Teas
  { id: "earl-gray", name: "Earl Gray", category: "Hot Teas", price: 170, veg: true, available: true },
  { id: "lemon-tea", name: "Lemon Tea", category: "Hot Teas", price: 170, veg: true, available: true },
  { id: "hibiscus", name: "Hibiscus", category: "Hot Teas", price: 190, veg: true, available: true },
  { id: "eng-breakfast", name: "Eng-Breakfast", category: "Hot Teas", price: 170, veg: true, available: true },
  { id: "blue-pea-tea", name: "Blue Pea Tea", category: "Hot Teas", price: 190, veg: true, available: true },
  { id: "green-tea", name: "Green Tea", category: "Hot Teas", price: 170, veg: true, available: true },

  // ————————————————————————————— All Day Breakfast
  { id: "honey-caramel-toast", name: "Honey Caramel Toast", category: "All Day Breakfast", price: 280, desc: "Honey crusted toast, topped with cream & berries.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "quinoa-poha", name: "Quinoa Poha", category: "All Day Breakfast", price: 320, desc: "Poha, fluffy quinoa, onion, mustard seeds, turmeric, green chillies & peanuts.", veg: true, allergens: ["nuts"], available: true },
  { id: "veggie-roast-tartine", name: "Veggie Roast Tartine", category: "All Day Breakfast", price: 360, desc: "Sourdough, hummus, tahini, roasted veggies, chimichurri.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "avocado-toast", name: "Avocado Toast", category: "All Day Breakfast", price: 360, desc: "Sourdough, ricotta, sliced hass avocado, crispy chilli oil.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "hummus-bowl", name: "Hummus Bowl", category: "All Day Breakfast", price: 390, desc: "Classic hummus with pita chips.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "korean-cheese-bun", name: "Korean Cheese Bun", category: "All Day Breakfast", price: 280, desc: "Soft bun filled with creamy garlic cheese.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "cheese-garlic-toast", name: "Cheese Garlic Toast", category: "All Day Breakfast", price: 220, desc: "Sourdough, garlic butter, melted cheese.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "chilly-garlic-toast", name: "Chilly Garlic Toast", category: "All Day Breakfast", price: 200, desc: "Sourdough, garlic butter, green chillis.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "guacamole-toast", name: "Guacamole Toast", category: "All Day Breakfast", price: 390, desc: "Guacamole spread on sourdough toast, topped with cherry tomatoes and fresh microgreens.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "paneer-tikka-open-toast", name: "Paneer Tikka Open Toast", category: "All Day Breakfast", price: 320, desc: "Grilled paneer tikka on sourdough with coriander cream.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "fluffy-pancakes", name: "Fluffy Pancakes", category: "All Day Breakfast", price: 320, desc: "Fluffy pancakes, sweet almond cream, seasonal compote.", veg: false, allergens: ["gluten", "dairy", "nuts", "egg"], available: true },
  { id: "waffle-heaven", name: "Waffle Heaven", category: "All Day Breakfast", price: 320, desc: "Vanilla waffle, topped with cream, vanilla ice cream.", veg: false, allergens: ["gluten", "dairy", "egg"], available: true },
  { id: "sunny-side-up", name: "Sunny Side Up", category: "All Day Breakfast", price: 390, desc: "Sourdough, egg fried just one side, salad.", veg: false, allergens: ["gluten", "egg"], available: true },
  { id: "strawberry-french-toast", name: "Strawberry French Toast", category: "All Day Breakfast", price: 390, desc: "Crusty brioche, topped with cream, compote & fresh strawberries.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "scrambled-eggs", name: "Scrambled Eggs", category: "All Day Breakfast", price: 320, desc: "Creamy scrambled eggs, toast, salad.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "masala-omelette", name: "Masala Omelette", category: "All Day Breakfast", price: 320, desc: "Mildly spiced omelette, toast, salad.", veg: false, allergens: ["gluten", "egg"], available: true },
  { id: "cheese-omelette", name: "Cheese Omelette", category: "All Day Breakfast", price: 340, desc: "Crescent omelette filled with cheese, toast, salad.", veg: false, allergens: ["gluten", "dairy", "egg"], available: true },
  { id: "mushroom-stuffed-omelette", name: "Mushroom Stuffed Omelette", category: "All Day Breakfast", price: 350, desc: "Served with salad & sourdough.", veg: false, allergens: ["gluten", "egg"], available: true },
  { id: "turkish-cilbir", name: "Turkish Cilbir", category: "All Day Breakfast", price: 360, desc: "Turkish yoghurt, poached eggs, sourdough.", veg: false, allergens: ["gluten", "dairy", "egg"], available: true },
  { id: "eggs-royale", name: "Eggs Royale", category: "All Day Breakfast", price: 420, desc: "English muffin, smoked salmon, pocket poached eggs, hollandaise.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "eggs-florentine", name: "Eggs Florentine", category: "All Day Breakfast", price: 420, desc: "English muffin, sautéed spinach, poached eggs, hollandaise.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "french-toast", name: "French Toast", category: "All Day Breakfast", price: 320, desc: "Crusty brioche, topped with cream.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "begal-sunshine", name: "Begal Sunshine", category: "All Day Breakfast", price: 350, desc: "Toasted bagel topped with herbed cream cheese, arugula, capers, and a sunny-side-up egg finished with chilli oil.", veg: false, allergens: ["gluten", "egg", "dairy"], available: true },
  { id: "tiramisu-french-toast", name: "Tiramisu French Toast", category: "All Day Breakfast", price: 350, desc: "Espresso-soaked brioche stacked with whipped mascarpone cream, cocoa dust.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Sandwiches
  { id: "bombay-toasty", name: "Bombay Toasty", category: "Sandwiches", price: 360, desc: "Sourdough, spiced mashed potatoes, coriander cream cheddar, mozzarella, tomato, caramelised onions.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "focaccia-cold", name: "Focaccia Cold", category: "Sandwiches", price: 360, desc: "Focaccia, ricotta, tomato pesto, roasted capsicum, marinated onions, dressed greens.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "spicy-mushroom", name: "Spicy Mushroom", category: "Sandwiches", price: 380, desc: "Sourdough, harissa, roasted mushrooms, mozzarella, cheddar.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "green-thumb", name: "Green Thumb", category: "Sandwiches", price: 380, desc: "Brioche bread, coriander cream, roasted zucchini, roasted beetroot, sliced tomatoes, peeled cucumber, capsicum cream.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "four-cheese-sandwich", name: "Four Cheese Sandwich", category: "Sandwiches", price: 350, desc: "Toasted brioche with Calabrian chili sauce and a blend of mozzarella, cheddar, parmesan, and cream cheese.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "charcoal-grilled-sandwich", name: "Charcoal Grilled Sandwich", category: "Sandwiches", price: 380, desc: "Sourdough, cottage cheese, coriander cream, harissa, cheddar, roasted capsicum & tomato.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "the-vegan-one", name: "The Vegan One", category: "Sandwiches", price: 440, desc: "Sourdough, tomato jam, capsicum cream, roasted capsicum, roasted pumpkin, roasted zucchini.", veg: true, allergens: ["gluten"], available: true },
  { id: "chicken-club-sandwich", name: "Chicken Club Sandwich", category: "Sandwiches", price: 420, desc: "Grilled minced chicken, egg, cheese, fresh greens, and juicy tomatoes layered with pesto and harissa spread on toasted bread.", veg: false, allergens: ["gluten", "egg"], available: true },
  { id: "mediterranean", name: "Mediterranean", category: "Sandwiches", price: 480, desc: "Sourdough, hummus, tahini, roasted veggies, grilled chicken and chimichurri.", veg: false, allergens: ["gluten", "dairy"], available: true },
  { id: "chicken-tikka-open-toast", name: "Chicken Tikka Open Toast", category: "Sandwiches", price: 350, desc: "Sourdough, marinated chicken tikka, onion, capsicum, cheese.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Salads
  { id: "greek-salad", name: "Greek Salad", category: "Salads", price: 360, desc: "Sliced cucumbers, tomatoes, green bell peppers, red onions, feta.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "pumpkin-quinoa-avocado", name: "Pumpkin Quinoa & Avocado", category: "Salads", price: 360, desc: "Cream cheese, orange zest.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "quinoa-tofu-scramble-salad", name: "Quinoa Tofu Scramble Salad", category: "Salads", price: 360, desc: "Quinoa, tomato pesto, tofu scramble, chimichurri.", veg: true, allergens: ["gluten"], available: true },
  { id: "somtum-salad", name: "Somtum Salad", category: "Salads", price: 330, desc: "Crisp juliennes of papaya, mango, and carrot tossed with peanuts and spring onions, topped with fried noodles and Asian chilli dressing.", veg: true, allergens: ["nuts"], available: true },
  { id: "veg-cesar-salad", name: "Veg Cesar Salad", category: "Salads", price: 380, desc: "Romaine, kalamata olives, cherry tomatoes, parmesan, broccoli, croutons, Cesar dressing.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "berry-burrata-salad", name: "Berry Burrata Salad", category: "Salads", price: 480, desc: "Mixed berries, arugula, cherry tomatoes, candied walnuts, grilled figs, burrata, honey mustard.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "chicken-cesar-salad", name: "Chicken Cesar Salad", category: "Salads", price: 420, desc: "Romaine, kalamata olives, cherry tomatoes, parmesan, grilled chicken, croutons, anchovy Cesar dressing.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Sides
  { id: "french-fries", name: "French Fries", category: "Sides", price: 260, veg: true, allergens: ["gluten"], available: true },
  { id: "peri-peri-fries", name: "Peri Peri Fries", category: "Sides", price: 280, veg: true, allergens: ["gluten"], available: true },
  { id: "potato-wedges", name: "Potato Wedges", category: "Sides", price: 280, veg: true, allergens: ["gluten"], available: true },

  // ————————————————————————————— Wraps
  { id: "pita-sabich-open-wrap", name: "Pita Sabich Open Wrap", category: "Wraps", price: 380, desc: "Warm pita, hummus, fattoush, grilled eggplant, falafel.", veg: true, allergens: ["gluten"], available: true },
  { id: "mexican-cottage-cheese-wrap", name: "Mexican Cottage Cheese Wrap", category: "Wraps", price: 380, desc: "Tortilla, refried beans, onions & capsicum, salsa, grilled cottage cheese, chimichurri, cheddar, feta.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "tex-mex-chicken-wrap", name: "Tex-Mex Chicken Wrap", category: "Wraps", price: 410, desc: "Tortilla, refried beans, onions & capsicum, salsa, grilled chicken, chimichurri, cheddar, feta.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Burgers & Bagels
  { id: "crispy-veg-burger", name: "Crispy Veg Burger", category: "Burgers & Bagels", price: 320, desc: "Signature bun, animal sauce, crispy patty, jalapenos, gherkins, lettuce, cheese.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "garden-fresh-bagel", name: "Garden Fresh Bagel", category: "Burgers & Bagels", price: 320, desc: "Signature bagel, cream cheese, roasted tomatoes, peeled cucumbers, pesto.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "grilled-mexican-burger", name: "Grilled Mexican Burger", category: "Burgers & Bagels", price: 320, desc: "Pangrilled jackfruit patty, lettuce, tomato & cheese.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "buffalo-chicken-burger", name: "Buffalo Chicken Burger", category: "Burgers & Bagels", price: 360, desc: "Signature bun, iceberg lettuce, buffalo chicken, cheese, animal sauce.", veg: false, allergens: ["gluten", "dairy"], available: true },
  { id: "mutton-smash-burger", name: "Mutton Smash Burger", category: "Burgers & Bagels", price: 460, desc: "Signature bun, smashed patty, animal sauce, cheese, caramelised onions, jalapenos.", veg: false, allergens: ["gluten", "dairy"], available: true },
  { id: "smoked-salmon-bagel", name: "Smoked Salmon Bagel", category: "Burgers & Bagels", price: 480, desc: "Signature bagel, rocket, smoked salmon, capers, cream cheese.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Cold Bowls
  { id: "quinoa-chia-pudding", name: "Quinoa Chia Pudding", category: "Cold Bowls", price: 380, desc: "Soaked chia & quinoa pudding, topped with fruits, nuts & spreads.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "over-night-oats", name: "Over Night Oats", category: "Cold Bowls", price: 440, desc: "Rolled oats, chia seeds soaked overnight, topped with fruits, nuts, spreads & fruit compote.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "tropical-smoothie-bowl", name: "Tropical Smoothie Bowl", category: "Cold Bowls", price: 420, desc: "Pineapple, banana, pomegranate, granola, seasonal chia pudding.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "granola-bowl", name: "Granola Bowl", category: "Cold Bowls", price: 480, desc: "House made cacao granola, cut fruits, coconut milk.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "rise-and-shine-bowl", name: "Rise & Shine Bowl", category: "Cold Bowls", price: 480, desc: "Seasonal fruits, honey dressing, Greek yoghurt, nuts & seeds.", veg: true, allergens: ["gluten", "nuts"], available: true },

  // ————————————————————————————— Plates & Bowls
  { id: "mexican-rice-bowl", name: "Mexican Rice Bowl", category: "Plates & Bowls", price: 380, desc: "Mexican pilaf, refried beans, roasted mushrooms, onions & peppers, guacamole, cheese, salsa, sour cream, dressed greens (tofu/paneer).", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "quinoa-bibimbap", name: "Quinoa Bibimbap", category: "Plates & Bowls", price: 420, desc: "Quinoa, roasted carrots, roasted mushrooms, kimchi, grilled tofu, bok choy, Asian salad, peanut satay sauce.", veg: true, allergens: ["gluten", "nuts"], available: true },
  { id: "parmesan-crusted-polenta", name: "Parmesan Crusted Polenta", category: "Plates & Bowls", price: 420, desc: "Parmesan polenta cakes, truffle cream, arrabbiata mushrooms.", veg: true, allergens: ["dairy"], available: true },
  { id: "mezze-platter", name: "Mezze Platter", category: "Plates & Bowls", price: 450, desc: "Classic hummus, beetroot hummus, muhammara sauce, tatziki, pickle, house salad, pita pocket & falafel.", veg: true, allergens: ["gluten", "dairy", "nuts"], available: true },
  { id: "sauteed-vegetables", name: "Sauteed Vegetables", category: "Plates & Bowls", price: 320, desc: "Seasonal vegetables, lightly sauteed in olive oil with garlic, salt, black pepper, and a touch of Italian seasoning.", veg: true, allergens: ["gluten"], available: true },
  { id: "chicken-mexican-rice-bowl", name: "Chicken Mexican Rice Bowl", category: "Plates & Bowls", price: 420, desc: "Same as the Mexican Rice Bowl, with chicken instead of tofu/paneer.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Smoothies
  { id: "tropical-fruit-smoothie", name: "Tropical Fruit Smoothie", category: "Smoothies", price: 380, desc: "Pineapple, banana, dragon fruit, tender coconut water.", veg: true, allergens: ["nuts"], available: true },
  { id: "chocolate-peanut-butter-smoothie", name: "Chocolate Peanut Butter Smoothie", category: "Smoothies", price: 380, desc: "Chocolate peanut butter, cacao cream, banana, coconut milk, dates.", veg: true, allergens: ["nuts"], available: true },
  { id: "strawberry-smoothie", name: "Strawberry Smoothie", category: "Smoothies", price: 380, desc: "Strawberry, banana, coconut milk.", veg: true, available: true },
  { id: "fig-and-banana-smoothie", name: "Fig & Banana Smoothie", category: "Smoothies", price: 420, desc: "Figs, almond butter, banana, coconut milk, cinnamon.", veg: true, allergens: ["nuts"], available: true },
  { id: "mixed-berry-smoothie", name: "Mixed Berry Smoothie", category: "Smoothies", price: 420, desc: "Raspberry, strawberry, blueberry, banana, coconut milk.", veg: true, available: true },

  // ————————————————————————————— Artisan Pizza
  { id: "pizza-margherita", name: "Pizza Margherita", category: "Artisan Pizza", price: 490, desc: "Marinara, mozzarella di bufala, EVOO, basil.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "garden-fresh-pizza", name: "Garden Fresh Pizza", category: "Artisan Pizza", price: 520, desc: "Marinara, mozzarella, broccoli, zucchini, bell pepper, onion, tomato & basil.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "pizza-al-funghi", name: "Pizza Al Funghi", category: "Artisan Pizza", price: 530, desc: "Marinara, mozzarella, sun-dried tomato & pan-grilled mushrooms topped with parmesan.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "quattro-formaggi", name: "Quattro Formaggi", category: "Artisan Pizza", price: 520, desc: "Four-cheese blend — mozzarella, feta, cheddar and parmesan.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "mexican-pizza", name: "Mexican Pizza", category: "Artisan Pizza", price: 520, desc: "Topped with harissa-marinated cottage cheese, corn, black olives, cherry tomatoes, jalapeños, and red onions on a rich Mexican spiced tomato base.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "pizza-de-pollo", name: "Pizza De Pollo", category: "Artisan Pizza", price: 540, desc: "Romana base with marinara, mozzarella, mushrooms, parsley topped with parmesan cheese.", veg: false, allergens: ["gluten", "dairy"], available: true },

  // ————————————————————————————— Pasta
  { id: "penne-taffeta", name: "Penne Taffeta", category: "Pasta", price: 390, desc: "Penne, marinara, pesto, stracciatella bufala.", veg: true, allergens: ["gluten", "dairy"], available: true },
  { id: "wild-mushroom-risotto", name: "Wild Mushroom Risotto", category: "Pasta", price: 410, desc: "Arborio rice, wild mushrooms, herbs, parmesan.", veg: true, allergens: ["gluten"], available: true },
  { id: "spaghetti-aglio-e-olio", name: "Spaghetti Aglio e Olio", category: "Pasta", price: 410, desc: "Spaghetti tossed with extra virgin olive oil, roasted garlic, chili flakes, parsley. Finished with parmesan shavings.", veg: true, allergens: ["gluten"], available: true },
  { id: "penne-pesto-burrata", name: "Penne Pesto Burrata", category: "Pasta", price: 440, desc: "Pasta tossed in a basil pesto sauce, enriched with extra virgin olive oil, garlic, and parmesan. Crowned with a fresh burrata.", veg: true, allergens: ["gluten", "dairy", "nuts"], available: true },
  { id: "fusilli-bianca", name: "Fusilli Bianca", category: "Pasta", price: 420, desc: "Fusilli pasta tossed in a rich and creamy white sauce, infused with garlic, parmesan.", veg: true, allergens: ["gluten"], available: true },

  // ————————————————————————————— Cookies & Dry Cakes
  { id: "almond-vegan-cookie", name: "Almond Vegan Cookie", category: "Cookies & Dry Cakes", price: 180, veg: true, available: true },
  { id: "chocolate-and-nutella-soft-center", name: "Chocolate & Nutella Soft Center", category: "Cookies & Dry Cakes", price: 190, veg: true, available: true },
  { id: "hazelnut-and-biscoff", name: "Hazelnut & Biscoff", category: "Cookies & Dry Cakes", price: 190, veg: true, available: true },
  { id: "chocolate-rocher", name: "Chocolate Rocher", category: "Cookies & Dry Cakes", price: 140, veg: true, available: true },
  { id: "marble-tea-cake", name: "Marble Tea Cake", category: "Cookies & Dry Cakes", price: 150, veg: true, available: true },
  { id: "lemon-dry-cake", name: "Lemon Dry Cake", category: "Cookies & Dry Cakes", price: 150, veg: true, available: true },

  // ————————————————————————————— Patisserie
  { id: "blueberry-cheese-cake", name: "Blueberry Cheese Cake", category: "Patisserie", price: 250, veg: true, available: true },
  { id: "opera", name: "Opera", category: "Patisserie", price: 250, veg: true, available: true },
  { id: "vegan-chocolate-desire", name: "Vegan Chocolate Desire", category: "Patisserie", price: 220, veg: true, available: true },
  { id: "caramelised-banoffee-delight", name: "Caramelised Banoffee Delight", category: "Patisserie", price: 240, veg: true, available: true },
  { id: "lotus-biscoff-cheesecake", name: "Lotus Biscoff Cheesecake", category: "Patisserie", price: 290, veg: true, available: true },
  { id: "hazelnut-tres-leches", name: "Hazelnut Tres-leches", category: "Patisserie", price: 250, veg: true, available: true },
  { id: "chocolate-basque-cheesecake", name: "Chocolate Basque Cheesecake", category: "Patisserie", price: 250, veg: true, available: true },
  { id: "ultimate-chocolate-eclair", name: "Ultimate Chocolate Eclair", category: "Patisserie", price: 200, veg: true, available: true },
  { id: "dutch-chocolate", name: "Dutch Chocolate", category: "Patisserie", price: 250, veg: true, available: true },
  { id: "pineapple-lychee-slice", name: "Pineapple Lychee Slice", category: "Patisserie", price: 230, veg: true, available: true },
  { id: "praline-royale", name: "Praline Royale", category: "Patisserie", price: 240, veg: true, available: true },
  { id: "kunafa-cheese-cake", name: "Kunafa Cheese Cake", category: "Patisserie", price: 280, veg: true, available: true },
  { id: "golden-pistachio", name: "Golden Pistachio", category: "Patisserie", price: 275, veg: true, available: true },
  { id: "strawberry-patit-gateaux", name: "Strawberry Patit Gateaux", category: "Patisserie", price: 280, veg: true, available: true },

  // ————————————————————————————— Viennoiseries
  { id: "carrot-cake", name: "Carrot Cake", category: "Viennoiseries", price: 220, veg: true, available: true },
  { id: "cookie-croissant", name: "Cookie Croissant", category: "Viennoiseries", price: 240, veg: true, available: true },
  { id: "pain-au-suisse", name: "Pain Au Suisse", category: "Viennoiseries", price: 220, veg: true, available: true },
  { id: "babka", name: "Babka", category: "Viennoiseries", price: 160, veg: true, available: true },
  { id: "butter-croissant", name: "Butter Croissant", category: "Viennoiseries", price: 210, veg: true, available: true },
  { id: "orange-vegan-cake", name: "Orange Vegan Cake", category: "Viennoiseries", price: 220, veg: true, available: true },
  { id: "rocher-croissant", name: "Rocher Croissant", category: "Viennoiseries", price: 250, veg: true, available: true },
  { id: "almond-croissant", name: "Almond Croissant", category: "Viennoiseries", price: 240, veg: true, available: true },
  { id: "chocolate-nutella-berliner", name: "Chocolate Nutella Berliner", category: "Viennoiseries", price: 180, veg: true, available: true },
  { id: "spinach-mushroom-quiche", name: "Spinach Mushroom Quiche", category: "Viennoiseries", price: 220, veg: true, available: true },
  { id: "pain-au-chocolate", name: "Pain Au Chocolate", category: "Viennoiseries", price: 210, veg: true, available: true },
  { id: "tomato-pesto-danish", name: "Tomato Pesto Danish", category: "Viennoiseries", price: 220, veg: true, available: true },
  { id: "coconut-matcha-berliner", name: "Coconut Matcha Berliner", category: "Viennoiseries", price: 180, veg: true, available: true },

  // ————————————————————————————— Indulgent Tubs
  { id: "classic-tiramisu", name: "Classic Tiramisu", category: "Indulgent Tubs", price: 345, veg: true, available: true },
  { id: "chocolate-and-nuts-tub", name: "Chocolate & Nuts", category: "Indulgent Tubs", price: 345, veg: true, allergens: ["nuts"], available: true },
  { id: "tres-leches", name: "Tres-Leches", category: "Indulgent Tubs", price: 325, veg: true, available: true },
  { id: "caramel-tres-leches", name: "Caramel Tres-leches", category: "Indulgent Tubs", price: 325, veg: true, available: true },
];

// —————————————————————————————— derived helpers (used by prompt + fallback)

export const menuById = new Map(menu.map((m) => [m.id, m]));

export const categories = [...new Set(menu.map((m) => m.category))];

export function itemName(id: string): string {
  return menuById.get(id)?.name ?? id;
}

// —————————————————————————————— Taffeta Specials (chef's recommendations)
// The owner's curated "what's special" list, grouped as they gave it. `groups`
// reference real priced items by id; `offMenu` names specials the owner calls
// out that aren't in the priced menu yet — the concierge may NAME these but
// must send the guest to the Order Taker for price, ingredients or any detail
// (we don't have that data, and inventing it breaks the whole grounding rule).
export const specials: {
  groups: { label: string; ids: string[] }[];
  offMenu: string[];
} = {
  groups: [
    { label: "Hot Coffee", ids: ["cappuccino", "pistachio-latte", "biscoff-latte", "flat-white"] },
    { label: "Iced Coffee", ids: ["spanish-iced-latte", "pistachio-iced-latte", "iced-mocha", "classic-frappe"] },
    { label: "Food", ids: ["garden-fresh-pizza", "penne-pesto-burrata", "penne-taffeta", "avocado-toast", "charcoal-grilled-sandwich"] },
    { label: "Pastry", ids: ["kunafa-cheese-cake", "rocher-croissant", "korean-cheese-bun"] },
  ],
  offMenu: ["Midnight Pastry", "London Cake Slice", "Mango Tres-leches", "Pistachio Eclairs"],
};

export const specialIds = new Set(specials.groups.flatMap((g) => g.ids));
