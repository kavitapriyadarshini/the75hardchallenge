/** Default age (years) for macro calculations. */
const DEFAULT_AGE_YEARS = 30

/** Mifflin-St Jeor basal metabolic rate in kcal/day. */
function mifflinStJeorBmr(weightKg, heightCm, gender) {
  const g = String(gender).toLowerCase()
  const isMale = g === 'male' || g === 'm'
  const base = 10 * weightKg + 6.25 * heightCm - 5 * DEFAULT_AGE_YEARS
  return isMale ? base + 5 : base - 161
}

/**
 * Daily targets from Mifflin-St Jeor BMR × 1.55 (moderately active),
 * with protein 1.8 g/kg, fat 25% calories, carbs as remainder, and fixed fiber/water targets.
 */
export function MACRO_CALC(weightKg, heightCm, gender) {
  const bmr = mifflinStJeorBmr(weightKg, heightCm, gender)
  const tdee = bmr * 1.55
  const calories = Math.round(tdee)

  const protein = Math.round(weightKg * 1.8)
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)
  const fiber = 25
  const waterMl = 3700
  const waterLiters = 3.7

  return { calories, protein, carbs, fat, fiber, waterMl, waterLiters }
}

export const FOOD_DB = {
  banana: {
    calories: 105,
    protein_g: 1.3,
    carbs_g: 27,
    fat_g: 0.4,
    fiber_g: 3.1,
    aliases: ['banana', 'bananas'],
  },
  almond: {
    calories: 46,
    protein_g: 1.7,
    carbs_g: 1.6,
    fat_g: 4,
    fiber_g: 0.9,
    aliases: ['almond', 'almonds', 'soaked almond', 'soaked almonds'],
  },
  salt: {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    aliases: ['salt', 'pinch of salt', 'sea salt', 'rock salt'],
  },
  ghee: { calories: 45, protein_g: 0, carbs_g: 0, fat_g: 5, fiber_g: 0, aliases: ['ghee'] },
  water: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, aliases: ['water'] },
  'turmeric water': { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, aliases: ['turmeric water', 'haldi water', 'turmeric', 'haldi'] },
  'ragi roti': { calories: 137, protein_g: 3.5, carbs_g: 29, fat_g: 0.8, fiber_g: 3.6, aliases: ['ragi roti', 'roti', 'chapati', 'chapatis'] },
  'moong dal cooked': { calories: 105, protein_g: 7.6, carbs_g: 19, fat_g: 0.4, fiber_g: 4, aliases: ['moong dal', 'mung dal'] },
  curd: { calories: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3, fiber_g: 0, aliases: ['curd', 'dahi', 'yogurt'] },
  'brown rice cooked': { calories: 112, protein_g: 2.3, carbs_g: 24, fat_g: 0.8, fiber_g: 1.8, aliases: ['brown rice', 'rice'] },
  'toor dal cooked': { calories: 116, protein_g: 7, carbs_g: 20, fat_g: 0.4, fiber_g: 5, aliases: ['toor dal', 'arhar dal', 'dal'] },
  paneer: { calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 20, fiber_g: 0, aliases: ['paneer'] },
  'chicken breast grilled': { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, aliases: ['chicken breast', 'grilled chicken', 'chicken'] },
  'egg white': { calories: 17, protein_g: 3.6, carbs_g: 0.2, fat_g: 0.1, fiber_g: 0, aliases: ['egg white', 'egg whites'] },
  cucumber: { calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, aliases: ['cucumber', 'kheera'] },
  tomato: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, aliases: ['tomato'] },
  onion: { calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, aliases: ['onion', 'pyaz'] },
  'spinach/palak': { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, aliases: ['palak', 'spinach'] },
  'chana roasted': { calories: 120, protein_g: 6, carbs_g: 18, fat_g: 2.5, fiber_g: 4.5, aliases: ['roasted chana', 'chana'] },
  makhana: { calories: 106, protein_g: 3.5, carbs_g: 20, fat_g: 0.5, fiber_g: 0.5, aliases: ['makhana', 'foxnut', 'fox nuts'] },
  watermelon: { calories: 30, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2, fiber_g: 0.4, aliases: ['watermelon'] },
  buttermilk: { calories: 40, protein_g: 3.2, carbs_g: 4.8, fat_g: 0.9, fiber_g: 0, aliases: ['buttermilk', 'chaas'] },
  'coconut water': { calories: 46, protein_g: 1.7, carbs_g: 8.9, fat_g: 0.5, fiber_g: 2.6, aliases: ['coconut water'] },
  'peanuts boiled': { calories: 107, protein_g: 4.6, carbs_g: 4.4, fat_g: 8, fiber_g: 1.8, aliases: ['boiled peanuts', 'peanuts'] },
  dates: { calories: 133, protein_g: 0.8, carbs_g: 36, fat_g: 0.2, fiber_g: 3.2, aliases: ['dates', 'date'] },
  walnuts: { calories: 98, protein_g: 2.3, carbs_g: 2.1, fat_g: 9.8, fiber_g: 1, aliases: ['walnut', 'walnuts'] },
  poha: { calories: 110, protein_g: 2.3, carbs_g: 23, fat_g: 0.5, fiber_g: 1, aliases: ['poha'] },
  murmura: { calories: 148, protein_g: 3.1, carbs_g: 32, fat_g: 0.5, fiber_g: 0.8, aliases: ['murmura', 'puffed rice'] },
  'murmura chiwda': { calories: 277, protein_g: 7.2, carbs_g: 36, fat_g: 11.8, fiber_g: 3.2, aliases: ['chiwda', 'chivda', 'murmura chiwda', 'murmura chivda'] },
  bread: { calories: 80, protein_g: 3, carbs_g: 15, fat_g: 1, fiber_g: 1, aliases: ['bread', 'slice bread'] },
  cheese: { calories: 113, protein_g: 7, carbs_g: 1, fat_g: 9, fiber_g: 0, aliases: ['cheese'] },
  mushroom: { calories: 22, protein_g: 3.1, carbs_g: 3.3, fat_g: 0.3, fiber_g: 1, aliases: ['mushroom', 'mushrooms'] },
  sandwich: { calories: 275, protein_g: 13, carbs_g: 29, fat_g: 11, fiber_g: 2, aliases: ['sandwich', 'cheese mushroom sandwich'] },
  idli: { calories: 58, protein_g: 2, carbs_g: 12, fat_g: 0.4, fiber_g: 0.5, aliases: ['idli', 'idlis'] },
  sambar: { calories: 55, protein_g: 2.8, carbs_g: 9, fat_g: 1, fiber_g: 2.5, aliases: ['sambar', 'sambhar'] },
  'rajma cooked': { calories: 127, protein_g: 8.7, carbs_g: 22, fat_g: 0.5, fiber_g: 6.4, aliases: ['rajma'] },
}

/**
 * Meal planner fallbacks (see `mealPlanAlternatives.js`):
 * MEAL_ALTERNATIVES[dietKey][slotKey] → string[3]  (one line per variant, ends with [P:.. C:.. F:.. ~..kcal])
 * dietKey: 'Indian (Ragi, Dal, Sabzi)' | 'Mediterranean' | 'General Healthy'
 * slotKey: MEAL_SLOT_ORDER — 'preWorkout' | 'breakfast' | 'lunch' | 'snack' | 'dinner'
 */
export {
  MEAL_ALTERNATIVES,
  MEAL_SLOT_ORDER,
  composeMealPlanFromAlternatives,
  mealTiersForDiet,
} from './mealPlanAlternatives.js'

export const WORKOUT_DB = {
  indoor: [
    {
      name: 'Treadmill intervals',
      type: 'cardio',
      desc: '45 minutes alternating easy jog and hard pushes on incline.',
    },
    {
      name: 'Stationary bike pyramid',
      type: 'cardio',
      desc: 'Build resistance each minute, recover, repeat for sustained heart rate.',
    },
    {
      name: 'Full-body dumbbell circuit',
      type: 'strength',
      desc: 'Compound moves: squats, rows, presses, lunges in rounds with short rest.',
    },
    {
      name: 'Bodyweight HIIT',
      type: 'cardio',
      desc: 'Burpees, mountain climbers, jump squats in timed intervals.',
    },
    {
      name: 'Yoga flow',
      type: 'flexibility',
      desc: 'Sun salutations and hip openers to reset posture and breath.',
    },
    {
      name: 'Rowing machine endurance',
      type: 'cardio',
      desc: 'Steady stroke rate with power emphasis every 5 minutes.',
    },
    {
      name: 'Core and glute strength',
      type: 'strength',
      desc: 'Planks, bridges, dead bugs, and hip thrusts for stability.',
    },
    {
      name: 'Mobility and stretch',
      type: 'flexibility',
      desc: 'Foam roll then long holds for shoulders, hamstrings, and thoracic spine.',
    },
  ],
  outdoor: [
    {
      name: 'Neighborhood power walk',
      type: 'cardio',
      desc: 'Brisk pace with arm drive; add short hill surges every few blocks.',
    },
    {
      name: 'Trail run easy',
      type: 'cardio',
      desc: 'Easy conversational pace on varied terrain for leg strength.',
    },
    {
      name: 'Park calisthenics',
      type: 'strength',
      desc: 'Pull-ups, dips, step-ups on benches, and push-ups in supersets.',
    },
    {
      name: 'Cycling commute loop',
      type: 'cardio',
      desc: '45 minutes on bike paths with a few tempo segments.',
    },
    {
      name: 'Outdoor yoga',
      type: 'flexibility',
      desc: 'Standing balance and flows on grass or deck.',
    },
    {
      name: 'Hill repeats',
      type: 'cardio',
      desc: 'Walk or run uphill hard, recover downhill, repeat.',
    },
    {
      name: 'Ruck or weighted walk',
      type: 'strength',
      desc: 'Backpack or vest at moderate pace to build endurance under load.',
    },
    {
      name: 'Active recovery walk',
      type: 'flexibility',
      desc: 'Slow walk with dynamic stretches every 10 minutes.',
    },
  ],
}
