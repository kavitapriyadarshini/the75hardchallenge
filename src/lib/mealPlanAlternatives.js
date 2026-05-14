/** 3 variants per slot × 5 slots × diet keys. Each line ends with macro token for UI parsing. */
function M(p, c, f, k) {
  return ` [P:${p}g C:${c}g F:${f}g ~${k}kcal]`
}

export const MEAL_SLOT_ORDER = ['preWorkout', 'breakfast', 'lunch', 'snack', 'dinner']

/** Light pre-workout + snack — shared across Indian cuisine types (per product spec). */
const INDIAN_LIGHT_PRE = [
  `🌅 Pre-workout (6:30 AM): 1 banana + 6 soaked almonds + water with pinch of salt${M(6, 22, 5, 160)}`,
  `🌅 Pre-workout (6:30 AM): 1 apple + handful roasted chana + jeera water${M(5, 28, 3, 150)}`,
  `🌅 Pre-workout (6:30 AM): dates (2) + walnuts (4) + coconut water (200ml)${M(4, 26, 6, 155)}`,
]

const INDIAN_LIGHT_SNACK = [
  `🍎 Snack (4:30 PM): Roasted chana (¼ cup) + 1 seasonal fruit + sabja water${M(10, 32, 5, 220)}`,
  `🍎 Snack (4:30 PM): makhana (1 cup roasted) + buttermilk + mint${M(9, 28, 6, 200)}`,
  `🍎 Snack (4:30 PM): mixed nuts (small handful) + orange + lemon water${M(8, 24, 10, 210)}`,
]

const NORTH_INDIAN_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): 2 whole-wheat parathas (plain) + curd bowl + cucumber + pickle (½ tsp)${M(14, 52, 14, 400)}`,
    `🍳 Breakfast (8:30 AM): poha with peas + peanuts + sev (little) + masala chai (small)${M(12, 55, 14, 400)}`,
    `🍳 Breakfast (8:30 AM): besan cheela (2) + mint chutney + buttermilk${M(16, 38, 12, 360)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): 2 rotis + toor dal (1 bowl) + seasonal sabzi + kachumber + chaas${M(18, 62, 12, 480)}`,
    `🍱 Lunch (1:00 PM): missi roti (2) + paneer bhurji + lauki sabzi + salad${M(24, 48, 16, 490)}`,
    `🍱 Lunch (1:00 PM): brown rice (¾ cup) + rajma + mixed veg + raita${M(16, 68, 10, 470)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): 2 rotis + palak paneer (small portion) + salad + cucumber raita${M(22, 44, 14, 430)}`,
    `🌙 Dinner (7:30 PM): khichdi + kadhi + beans sabzi + pickle (½ tsp)${M(14, 58, 9, 410)}`,
    `🌙 Dinner (7:30 PM): jowar roti (2) + methi aloo + moong dal + onion salad${M(16, 54, 11, 440)}`,
  ],
}

const SOUTH_INDIAN_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): 3 idli + sambar (1 bowl) + coconut chutney + filter coffee (small)${M(12, 58, 6, 380)}`,
    `🍳 Breakfast (8:30 AM): masala dosa (1) + sambar + chutney + buttermilk${M(10, 62, 12, 420)}`,
    `🍳 Breakfast (8:30 AM): pongal + sambar + coconut chutney + papaya${M(11, 54, 10, 390)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): steamed rice (1 cup) + sambar + poriyal + curd${M(12, 72, 8, 460)}`,
    `🍱 Lunch (1:00 PM): rice + rasam + beans curry + cucumber salad + pickle (½ tsp)${M(11, 70, 9, 450)}`,
    `🍱 Lunch (1:00 PM): lemon rice + dal tadka + okra fry + buttermilk${M(10, 68, 10, 440)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): rice (¾ cup) + sambar + cabbage curry + curd${M(10, 65, 7, 410)}`,
    `🌙 Dinner (7:30 PM): millet dosa (2) + tomato chutney + veg kootu + salad${M(12, 52, 10, 400)}`,
    `🌙 Dinner (7:30 PM): curd rice + pickle (½ tsp) + stir-fried beans + rasam (small)${M(9, 58, 8, 380)}`,
  ],
}

const FUSION_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): idli (2) + paratha (1 small) + sambar + curd${M(14, 60, 10, 400)}`,
    `🍳 Breakfast (8:30 AM): upma + coconut chutney + boiled egg + fruit${M(14, 48, 10, 380)}`,
    `🍳 Breakfast (8:30 AM): dosa (1) + paneer bhurji (small) + mint chutney${M(20, 45, 14, 410)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): roti (1) + rice (½ cup) + dal + sambar + mixed veg salad${M(16, 72, 10, 480)}`,
    `🍱 Lunch (1:00 PM): quinoa pulao + raita + stir-fry sabzi + papad${M(14, 65, 9, 450)}`,
    `🍱 Lunch (1:00 PM): millet roti + sambar + poriyal + buttermilk${M(12, 62, 11, 460)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): rice (½ cup) + roti (1) + dal tadka + beans sabzi + salad${M(14, 68, 9, 430)}`,
    `🌙 Dinner (7:30 PM): khichdi + coconut chutney + kachumber + chaas${M(12, 55, 10, 400)}`,
    `🌙 Dinner (7:30 PM): grilled paneer tikka + millet + rasam + veg${M(22, 48, 12, 420)}`,
  ],
}

const HIGH_PROTEIN_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): 3 egg whites + 1 whole egg + sprout salad + 1 multigrain toast${M(24, 32, 12, 360)}`,
    `🍳 Breakfast (8:30 AM): paneer bhurji + moong sprouts + roti (1) + buttermilk${M(26, 38, 14, 400)}`,
    `🍳 Breakfast (8:30 AM): Greek-style curd bowl + chana + seeds + fruit${M(22, 40, 10, 380)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): grilled chicken or paneer (palm) + dal (1 bowl) + quinoa + salad${M(38, 45, 12, 500)}`,
    `🍱 Lunch (1:00 PM): rajma + brown rice + egg curry (1 egg) + veg${M(28, 62, 10, 490)}`,
    `🍱 Lunch (1:00 PM): fish or tofu curry + millet + sprouts salad${M(32, 48, 12, 480)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): paneer tikka + mixed dal + sautéed greens + salad${M(30, 40, 12, 430)}`,
    `🌙 Dinner (7:30 PM): egg curry (2 eggs) + roti (1) + sabzi + raita${M(26, 44, 14, 440)}`,
    `🌙 Dinner (7:30 PM): tofu stir-fry + sprouts + khichdi (small)${M(24, 52, 10, 410)}`,
  ],
}

const VEG_INDIAN_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): poha + peanuts + sev + chai (small)${M(10, 52, 12, 360)}`,
    `🍳 Breakfast (8:30 AM): idli (3) + sambar + chutney + fruit${M(10, 58, 5, 350)}`,
    `🍳 Breakfast (8:30 AM): paratha (1) + curd + pickle + salad${M(10, 48, 12, 380)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): roti (2) + dal + sabzi + salad + chaas${M(14, 62, 10, 450)}`,
    `🍱 Lunch (1:00 PM): rice + sambar + poriyal + papad + curd${M(11, 70, 8, 440)}`,
    `🍱 Lunch (1:00 PM): khichdi + kadhi + kachumber${M(12, 58, 8, 400)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): roti + paneer curry + salad + raita${M(18, 46, 12, 400)}`,
    `🌙 Dinner (7:30 PM): dosa + sambar + veg stir-fry${M(10, 55, 10, 380)}`,
    `🌙 Dinner (7:30 PM): millet roti + mixed veg + dal${M(14, 52, 10, 410)}`,
  ],
}

const VEGAN_INDIAN_CORE = {
  breakfast: [
    `🍳 Breakfast (8:30 AM): idli (3) + sambar + coconut chutney + fruit${M(9, 58, 6, 340)}`,
    `🍳 Breakfast (8:30 AM): masala oats + peanut + veggies + lemon${M(11, 48, 8, 320)}`,
    `🍳 Breakfast (8:30 AM): upma with vegetables + coconut chutney${M(8, 52, 8, 330)}`,
  ],
  lunch: [
    `🍱 Lunch (1:00 PM): rice + sambar + beans poriyal + salad (no dairy)${M(10, 72, 7, 430)}`,
    `🍱 Lunch (1:00 PM): millet roti + mixed veg + masoor dal + pickle${M(14, 65, 9, 450)}`,
    `🍱 Lunch (1:00 PM): quinoa + chickpea curry + roasted veg${M(15, 68, 10, 460)}`,
  ],
  dinner: [
    `🌙 Dinner (7:30 PM): tofu curry + millet + stir-fried greens${M(18, 48, 10, 400)}`,
    `🌙 Dinner (7:30 PM): veg pulao + raita (plant yogurt) + salad${M(10, 65, 8, 390)}`,
    `🌙 Dinner (7:30 PM): dal + roti + baingan bharta + salad${M(12, 58, 9, 410)}`,
  ],
}

function indianMeals(core) {
  return {
    preWorkout: INDIAN_LIGHT_PRE,
    breakfast: core.breakfast,
    lunch: core.lunch,
    snack: INDIAN_LIGHT_SNACK,
    dinner: core.dinner,
  }
}

export const MEAL_ALTERNATIVES = {
  'North Indian (Roti, Dal, Sabzi, Paneer)': indianMeals(NORTH_INDIAN_CORE),
  'South Indian (Rice, Sambar, Dosa, Idli)': indianMeals(SOUTH_INDIAN_CORE),
  'Indian Fusion (Mix of North + South)': indianMeals(FUSION_CORE),
  'Mediterranean (Olive oil, Legumes, Fish, Veggies)': {
    preWorkout: [
      `🌅 Pre-workout (6:30 AM): Small Greek yogurt (150g) + 6 walnuts + water with lemon${M(14, 12, 14, 220)}`,
      `🌅 Pre-workout (6:30 AM): whole-grain crackers (3) + hummus (2 tbsp) + herbal tea${M(6, 22, 8, 180)}`,
      `🌅 Pre-workout (6:30 AM): banana + olives (few) + water${M(2, 24, 4, 130)}`,
    ],
    breakfast: [
      `🍳 Breakfast (8:30 AM): Whole-grain toast + avocado + 2 eggs + cherry tomatoes + olive oil drizzle${M(22, 28, 22, 420)}`,
      `🍳 Breakfast (8:30 AM): Greek yogurt bowl + berries + granola (¼ cup) + honey (1 tsp)${M(18, 42, 8, 360)}`,
      `🍳 Breakfast (8:30 AM): shakshuka (2 eggs in tomato sauce) + whole-wheat pita (small) + parsley${M(20, 35, 18, 400)}`,
    ],
    lunch: [
      `🍱 Lunch (1:00 PM): Grilled fish + quinoa + chickpea salad + cucumber-tomato + tzatziki${M(38, 42, 16, 520)}`,
      `🍱 Lunch (1:00 PM): lentil soup + Greek salad + feta (30g) + whole-grain bread (1 slice) + olive oil${M(22, 55, 18, 480)}`,
      `🍱 Lunch (1:00 PM): grilled halloumi + couscous (¾ cup) + roasted veg + tahini drizzle${M(24, 58, 20, 510)}`,
    ],
    snack: [
      `🍎 Snack (4:30 PM): Hummus (⅓ cup) + carrot & bell pepper sticks + olives (few)${M(8, 22, 12, 210)}`,
      `🍎 Snack (4:30 PM): apple + almond butter (1 tbsp) + green tea${M(4, 26, 10, 180)}`,
      `🍎 Snack (4:30 PM): cottage cheese (½ cup) + cucumber sticks + oregano + lemon${M(16, 8, 5, 140)}`,
    ],
    dinner: [
      `🌙 Dinner (7:30 PM): Lentil soup + whole-wheat pasta (small portion) + mixed greens + feta (small)${M(20, 52, 14, 450)}`,
      `🌙 Dinner (7:30 PM): baked salmon + roasted zucchini + tabbouleh + lemon wedge${M(32, 28, 18, 440)}`,
      `🌙 Dinner (7:30 PM): grilled chicken + ratatouille + small polenta + basil${M(35, 40, 12, 430)}`,
    ],
  },
  'High Protein Indian (Eggs, Paneer, Dal, Sprouts)': indianMeals(HIGH_PROTEIN_CORE),
  'Vegetarian Indian': indianMeals(VEG_INDIAN_CORE),
  'Vegan Indian': indianMeals(VEGAN_INDIAN_CORE),
  'General Healthy (Balanced, no restriction)': {
    preWorkout: [
      `🌅 Pre-workout (6:30 AM): 1 banana + handful mixed nuts + water${M(6, 28, 10, 200)}`,
      `🌅 Pre-workout (6:30 AM): rice cake (2) + almond butter + black coffee or water${M(5, 24, 9, 170)}`,
      `🌅 Pre-workout (6:30 AM): protein shake (half scoop) + half banana${M(12, 15, 3, 120)}`,
    ],
    breakfast: [
      `🍳 Breakfast (8:30 AM): Oats (½ cup dry) + milk or soy milk + berries + chia seeds${M(16, 52, 8, 380)}`,
      `🍳 Breakfast (8:30 AM): 2 whole-wheat toast + scrambled eggs (2) + spinach + fruit${M(22, 36, 14, 380)}`,
      `🍳 Breakfast (8:30 AM): smoothie: whey + oats + banana + spinach + water${M(28, 40, 6, 360)}`,
    ],
    lunch: [
      `🍱 Lunch (1:00 PM): Brown rice (¾ cup) + lean protein palm-sized + mixed vegetables + side salad${M(35, 55, 12, 520)}`,
      `🍱 Lunch (1:00 PM): whole-wheat wrap + turkey or tofu + hummus + shredded veg${M(32, 48, 14, 480)}`,
      `🍱 Lunch (1:00 PM): quinoa bowl + black beans + corn + salsa + avocado (¼)${M(18, 62, 14, 490)}`,
    ],
    snack: [
      `🍎 Snack (4:30 PM): Apple + peanut butter (1 tbsp) or cottage cheese + fruit${M(8, 28, 9, 210)}`,
      `🍎 Snack (4:30 PM): protein bar (small) + herbal tea${M(15, 22, 8, 220)}`,
      `🍎 Snack (4:30 PM): edamame (1 cup) + carrot sticks${M(14, 18, 5, 180)}`,
    ],
    dinner: [
      `🌙 Dinner (7:30 PM): Grilled tofu or chicken + roasted sweet potato + steamed broccoli + olive oil${M(38, 40, 14, 450)}`,
      `🌙 Dinner (7:30 PM): baked white fish + asparagus + small baked potato + herbs${M(34, 38, 10, 420)}`,
      `🌙 Dinner (7:30 PM): turkey or lentil patties + green beans + cauliflower rice + tzatziki${M(32, 35, 12, 400)}`,
    ],
  },
}

/** Map legacy `diet_type` values saved before cuisine expansion. */
const DIET_TYPE_ALIAS = {
  'Indian (Ragi, Dal, Sabzi)': 'North Indian (Roti, Dal, Sabzi, Paneer)',
  'General Healthy': 'General Healthy (Balanced, no restriction)',
  Mediterranean: 'Mediterranean (Olive oil, Legumes, Fish, Veggies)',
}

export function mealTiersForDiet(dietType) {
  const key = DIET_TYPE_ALIAS[dietType] ?? dietType
  return (
    MEAL_ALTERNATIVES[key] ?? MEAL_ALTERNATIVES['General Healthy (Balanced, no restriction)']
  )
}

/** @param {number[] | null} slotIndices length 5 — variant index per slot */
export function composeMealPlanFromAlternatives(dietType, slotIndices) {
  const tiers = mealTiersForDiet(dietType)
  return MEAL_SLOT_ORDER.map((slot, i) => {
    const bucket = tiers[slot]
    const v = slotIndices?.[i] ?? 0
    return bucket[v % bucket.length]
  }).join('\n')
}
