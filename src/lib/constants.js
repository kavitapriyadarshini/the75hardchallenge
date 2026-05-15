/** Mifflin-St Jeor basal metabolic rate in kcal/day. */
function mifflinStJeorBmr(weightKg, heightCm, gender, ageYears) {
  const g = String(gender).toLowerCase()
  const isMale = g === 'male' || g === 'm'
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return isMale ? base + 5 : base - 161
}

/**
 * Daily targets from Mifflin-St Jeor BMR × challenge activity multiplier,
 * with protein 1.8 g/kg, fat 25% calories, carbs as remainder, and fixed fiber/water targets.
 */
export function MACRO_CALC(weightKg, heightCm, gender, age, challengeType) {
  const ageYears = Number.isFinite(Number(age)) ? Math.max(16, Math.min(80, Number(age))) : 30
  const type = String(challengeType || '').toLowerCase()
  const isSoft = type === '75soft'
  const bmr = mifflinStJeorBmr(weightKg, heightCm, gender, ageYears)
  const tdee = bmr * (isSoft ? 1.4 : 1.55)
  const calories = Math.round(tdee)

  const protein = Math.round(weightKg * 1.8)
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)
  const fiber = 25
  const waterMl = isSoft ? 3000 : 3700
  const waterLiters = isSoft ? 3 : 3.7

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

/** @typedef {'cardio'|'strength'|'flexibility'} WorkoutType */
/** @typedef {'indoor'|'outdoor'} WorkoutLocation */
/** @typedef {'upper'|'lower'|'core'|'full'|'recovery'} WorkoutTarget */

/**
 * Workout catalog: name, type, desc, location, targets (for filter chips).
 * Chips: Upper Body · Lower Body · Core · Full Body · Recovery map via `targets`.
 */
export const WORKOUT_DB = {
  indoor: [
    {
      name: 'Yoga flow',
      type: 'flexibility',
      desc: 'Sun salutations, warrior sequence, hip openers',
      location: 'indoor',
      targets: ['recovery'],
    },
    {
      name: 'Pilates mat',
      type: 'flexibility',
      desc: 'Core, glute, and hip activation with controlled movement',
      location: 'indoor',
      targets: ['core'],
    },
    {
      name: 'Bodyweight HIIT',
      type: 'cardio',
      desc: 'Burpees, jump squats, mountain climbers, high knees',
      location: 'indoor',
      targets: ['full'],
    },
    {
      name: 'Core and glute strength',
      type: 'strength',
      desc: 'Planks, bridges, dead bugs, hip thrusts',
      location: 'indoor',
      targets: ['core', 'lower'],
    },
    {
      name: 'Full body dumbbell circuit',
      type: 'strength',
      desc: 'Squats, rows, presses, lunges in rounds',
      location: 'indoor',
      targets: ['full'],
    },
    {
      name: 'Jump rope intervals',
      type: 'cardio',
      desc: '3 min jump / 1 min rest, repeat',
      location: 'indoor',
      targets: ['lower'],
    },
    {
      name: 'Staircase intervals',
      type: 'cardio',
      desc: 'Up/down stair sprints with bodyweight squats',
      location: 'indoor',
      targets: ['lower'],
    },
    {
      name: 'Dance cardio',
      type: 'cardio',
      desc: 'High energy movement, Bollywood or Zumba style',
      location: 'indoor',
      targets: ['full'],
    },
    {
      name: 'Resistance band full body',
      type: 'strength',
      desc: 'Arms, glutes, back, core with bands',
      location: 'indoor',
      targets: ['full', 'upper', 'lower'],
    },
    {
      name: 'Rowing machine endurance',
      type: 'cardio',
      desc: 'Steady stroke rate with power bursts',
      location: 'indoor',
      targets: ['full'],
    },
    {
      name: 'Treadmill intervals',
      type: 'cardio',
      desc: 'Easy jog alternating with hard incline pushes',
      location: 'indoor',
      targets: ['lower'],
    },
    {
      name: 'Stationary bike pyramid',
      type: 'cardio',
      desc: 'Build resistance each minute, recover, repeat',
      location: 'indoor',
      targets: ['lower'],
    },
    {
      name: 'Mobility and stretch',
      type: 'flexibility',
      desc: 'Foam roll, long holds for shoulders and hamstrings',
      location: 'indoor',
      targets: ['recovery'],
    },
    {
      name: 'Chest and triceps',
      type: 'strength',
      desc: 'Push-ups, dips, chest press, tricep extensions',
      location: 'indoor',
      targets: ['upper'],
    },
    {
      name: 'Back and biceps',
      type: 'strength',
      desc: 'Dumbbell rows, pull-ups or negatives, bicep curls',
      location: 'indoor',
      targets: ['upper'],
    },
    {
      name: 'Shoulders and arms',
      type: 'strength',
      desc: 'Overhead press, lateral raises, front raises, curls',
      location: 'indoor',
      targets: ['upper'],
    },
    {
      name: 'Legs and glutes',
      type: 'strength',
      desc: 'Squats, lunges, deadlifts, glute bridges, calf raises',
      location: 'indoor',
      targets: ['lower'],
    },
    {
      name: 'Core and abs',
      type: 'strength',
      desc: 'Crunches, leg raises, Russian twists, plank variations',
      location: 'indoor',
      targets: ['core'],
    },
    {
      name: 'Upper body push',
      type: 'strength',
      desc: 'Push-up variations, shoulder press, chest flyes',
      location: 'indoor',
      targets: ['upper'],
    },
    {
      name: 'Upper body pull',
      type: 'strength',
      desc: 'Rows, face pulls, band pull-aparts, bicep work',
      location: 'indoor',
      targets: ['upper'],
    },
  ],
  outdoor: [
    {
      name: 'Brisk walk',
      type: 'cardio',
      desc: 'Maintain pace where you can speak but feel effort',
      location: 'outdoor',
      targets: ['full'],
    },
    {
      name: 'Run / walk intervals',
      type: 'cardio',
      desc: '3 min run + 2 min walk, repeat for 45 min',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Steady state run',
      type: 'cardio',
      desc: 'Comfortable 5–7km run at conversational pace',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Tempo run',
      type: 'cardio',
      desc: 'Comfortably hard pace sustained for 20–30 min with warm up/cool down',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Sprint intervals',
      type: 'cardio',
      desc: '30 sec all-out sprint, 90 sec walk, repeat 10 times',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Rucking',
      type: 'strength',
      desc: 'Walk with 5–8kg backpack, burns 3x more than regular walking',
      location: 'outdoor',
      targets: ['lower', 'full'],
    },
    {
      name: 'Cycling',
      type: 'cardio',
      desc: 'Steady cycling on flat roads, 45 min moderate effort',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Hill cycling',
      type: 'cardio',
      desc: 'Cycling with elevation, builds leg strength and endurance',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Swimming',
      type: 'cardio',
      desc: 'Laps in pool, mix of strokes, excellent full body workout',
      location: 'outdoor',
      targets: ['full'],
    },
    {
      name: 'Outdoor yoga',
      type: 'flexibility',
      desc: 'Yoga on terrace or park, early morning recommended',
      location: 'outdoor',
      targets: ['recovery'],
    },
    {
      name: 'Park circuit',
      type: 'strength',
      desc: 'Bench dips, pull-ups on bars, walking lunges, step-ups',
      location: 'outdoor',
      targets: ['full', 'upper'],
    },
    {
      name: 'Trail run',
      type: 'cardio',
      desc: 'Easy conversational pace on varied terrain',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Jogging',
      type: 'cardio',
      desc: 'Easy 4–5km jog, focus on consistent pace and breathing',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Outdoor HIIT',
      type: 'cardio',
      desc: 'Sprint, squat, lunge, push-up circuit in a park',
      location: 'outdoor',
      targets: ['full'],
    },
    {
      name: 'Football / basketball',
      type: 'cardio',
      desc: 'Recreational sport counts as outdoor workout',
      location: 'outdoor',
      targets: ['full'],
    },
    {
      name: 'Jump rope outdoors',
      type: 'cardio',
      desc: 'Take your rope outside, same intervals as indoor',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Stair running outdoors',
      type: 'cardio',
      desc: 'Find outdoor stairs or stadium steps, run repeats',
      location: 'outdoor',
      targets: ['lower'],
    },
    {
      name: 'Outdoor stretching and mobility',
      type: 'flexibility',
      desc: 'Long hold stretches in fresh air',
      location: 'outdoor',
      targets: ['recovery'],
    },
    {
      name: 'Neighborhood power walk',
      type: 'cardio',
      desc: 'Fast-paced walk with arm swing and core engagement',
      location: 'outdoor',
      targets: ['full'],
    },
    {
      name: 'Badminton / tennis',
      type: 'cardio',
      desc: 'Recreational racket sport, great cardio and coordination',
      location: 'outdoor',
      targets: ['upper', 'full'],
    },
  ],
}
