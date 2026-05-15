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

/**
 * Workout catalog for the Workouts tab: name, type, muscleGroup (chip filters), desc, location.
 * Chips map muscleGroup to: upper body · lower body · core · full body.
 */
export const WORKOUT_DB = {
  indoor: [
    {
      name: 'Yoga flow',
      type: 'flexibility',
      muscleGroup: 'full body',
      desc: 'Sun salutations, warrior sequence, hip openers, 45 min flow',
      location: 'indoor',
    },
    {
      name: 'Pilates mat',
      type: 'flexibility',
      muscleGroup: 'core',
      desc: 'Core, glute, and hip activation with controlled movement',
      location: 'indoor',
    },
    {
      name: 'Bodyweight HIIT',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Burpees, jump squats, mountain climbers, high knees intervals',
      location: 'indoor',
    },
    {
      name: 'Core and abs',
      type: 'strength',
      muscleGroup: 'core',
      desc: 'Crunches, leg raises, Russian twists, plank variations, hollow holds',
      location: 'indoor',
    },
    {
      name: 'Full body dumbbell circuit',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Squats, rows, presses, lunges in timed rounds',
      location: 'indoor',
    },
    {
      name: 'Jump rope intervals',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: '3 min jump / 1 min rest, repeat for 45 min',
      location: 'indoor',
    },
    {
      name: 'Staircase intervals',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Up/down stair sprints with bodyweight squats',
      location: 'indoor',
    },
    {
      name: 'Dance cardio',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'High energy Bollywood or Zumba style movement',
      location: 'indoor',
    },
    {
      name: 'Resistance band full body',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Arms, glutes, back, core with resistance bands',
      location: 'indoor',
    },
    {
      name: 'Rowing machine endurance',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Steady stroke rate with power bursts every 5 min',
      location: 'indoor',
    },
    {
      name: 'Treadmill intervals',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Easy jog alternating with hard incline pushes',
      location: 'indoor',
    },
    {
      name: 'Stationary bike pyramid',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Build resistance each minute, recover, repeat',
      location: 'indoor',
    },
    {
      name: 'Mobility and stretch',
      type: 'flexibility',
      muscleGroup: 'full body',
      desc: 'Foam roll, long holds for shoulders, hamstrings, thoracic spine',
      location: 'indoor',
    },
    {
      name: 'Chest and triceps',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Push-ups, dips, chest press, tricep extensions, close-grip press',
      location: 'indoor',
    },
    {
      name: 'Back and biceps',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Dumbbell rows, pull-ups or negatives, bicep curls, face pulls',
      location: 'indoor',
    },
    {
      name: 'Shoulders',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Overhead press, lateral raises, front raises, rear delt flyes, shrugs',
      location: 'indoor',
    },
    {
      name: 'Triceps isolation',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Tricep dips, overhead extensions, pushdowns, skull crushers',
      location: 'indoor',
    },
    {
      name: 'Biceps isolation',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Barbell curls, hammer curls, concentration curls, 21s',
      location: 'indoor',
    },
    {
      name: 'Arms workout',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Superset biceps and triceps — curls, extensions, dips, rows',
      location: 'indoor',
    },
    {
      name: 'Chest workout',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Push-up variations, chest press, chest flyes, decline push-ups',
      location: 'indoor',
    },
    {
      name: 'Back workout',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Rows, pull-ups, lat pulldown, deadlifts, back extensions',
      location: 'indoor',
    },
    {
      name: 'Shoulders workout',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Full shoulder circuit — press, raises, rotations, shrugs',
      location: 'indoor',
    },
    {
      name: 'Upper body strength',
      type: 'strength',
      muscleGroup: 'upper body',
      desc: 'Compound upper body — press, pull, rows, carries',
      location: 'indoor',
    },
    {
      name: 'Legs and glutes',
      type: 'strength',
      muscleGroup: 'lower body',
      desc: 'Squats, lunges, deadlifts, glute bridges, calf raises',
      location: 'indoor',
    },
    {
      name: 'Quads focus',
      type: 'strength',
      muscleGroup: 'lower body',
      desc: 'Front squats, leg press, step-ups, wall sits, quad extensions',
      location: 'indoor',
    },
    {
      name: 'Hamstrings focus',
      type: 'strength',
      muscleGroup: 'lower body',
      desc: 'Romanian deadlifts, lying leg curls, Nordic curls, good mornings',
      location: 'indoor',
    },
    {
      name: 'Glutes focus',
      type: 'strength',
      muscleGroup: 'lower body',
      desc: 'Hip thrusts, glute bridges, donkey kicks, clamshells, sumo squats',
      location: 'indoor',
    },
    {
      name: 'Lower body strength',
      type: 'strength',
      muscleGroup: 'lower body',
      desc: 'Squats, deadlifts, lunges, step-ups, calf raises compound circuit',
      location: 'indoor',
    },
    {
      name: 'Calisthenics',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Push-ups, pull-ups, dips, squats, L-sits, muscle-up progressions',
      location: 'indoor',
    },
    {
      name: 'Boxing / shadow boxing',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Shadow boxing rounds, bag work, footwork drills, combos',
      location: 'indoor',
    },
    {
      name: 'Kickboxing',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Kicks, punches, knee strikes in timed rounds',
      location: 'indoor',
    },
  ],
  outdoor: [
    {
      name: 'Brisk walk',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Maintain pace where you can speak but feel effort, arms swinging',
      location: 'outdoor',
    },
    {
      name: 'Run / walk intervals',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: '3 min run + 2 min walk, repeat for 45 min',
      location: 'outdoor',
    },
    {
      name: 'Steady state jog',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Easy 4–5km jog at comfortable conversational pace',
      location: 'outdoor',
    },
    {
      name: 'Steady state run',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: '5–7km run at moderate effort, consistent pace',
      location: 'outdoor',
    },
    {
      name: 'Tempo run',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Comfortably hard pace for 20–30 min with warm up and cool down',
      location: 'outdoor',
    },
    {
      name: 'Sprint intervals',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: '30 sec all-out sprint, 90 sec walk, repeat 10–12 times',
      location: 'outdoor',
    },
    {
      name: 'Rucking',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Walk with 5–8kg backpack, burns 3x more than regular walking',
      location: 'outdoor',
    },
    {
      name: 'Cycling flat',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Steady cycling on flat roads, 45 min moderate effort',
      location: 'outdoor',
    },
    {
      name: 'Hill cycling',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Cycling with elevation changes, builds leg strength and endurance',
      location: 'outdoor',
    },
    {
      name: 'Swimming',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Laps in pool, mix of freestyle, breaststroke, backstroke',
      location: 'outdoor',
    },
    {
      name: 'Outdoor yoga',
      type: 'flexibility',
      muscleGroup: 'full body',
      desc: 'Yoga on terrace or in park, early morning recommended',
      location: 'outdoor',
    },
    {
      name: 'Park circuit',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Bench dips, pull-ups on bars, walking lunges, step-ups, push-ups',
      location: 'outdoor',
    },
    {
      name: 'Trail run',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Easy pace on varied terrain, great for mental reset',
      location: 'outdoor',
    },
    {
      name: 'Outdoor HIIT',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Sprint, squat, lunge, push-up circuit in a park or open space',
      location: 'outdoor',
    },
    {
      name: 'Basketball',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Recreational game or solo drills — dribbling, shooting, sprints',
      location: 'outdoor',
    },
    {
      name: 'Pickleball',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Fast-paced racket sport, excellent agility and cardio',
      location: 'outdoor',
    },
    {
      name: 'Badminton',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Recreational game, great cardio and hand-eye coordination',
      location: 'outdoor',
    },
    {
      name: 'Tennis',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Recreational tennis, continuous rallies for cardio',
      location: 'outdoor',
    },
    {
      name: 'Football / soccer',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Recreational game or solo dribbling and shooting drills',
      location: 'outdoor',
    },
    {
      name: 'Jump rope outdoors',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Take your rope outside, same intervals as indoor version',
      location: 'outdoor',
    },
    {
      name: 'Stair running outdoors',
      type: 'cardio',
      muscleGroup: 'lower body',
      desc: 'Outdoor stairs or stadium steps, run repeats for 45 min',
      location: 'outdoor',
    },
    {
      name: 'Outdoor stretching',
      type: 'flexibility',
      muscleGroup: 'full body',
      desc: 'Long hold stretches and mobility work in fresh air',
      location: 'outdoor',
    },
    {
      name: 'Neighborhood power walk',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Fast-paced walk with arm drive and core engagement',
      location: 'outdoor',
    },
    {
      name: 'Calisthenics outdoors',
      type: 'strength',
      muscleGroup: 'full body',
      desc: 'Park bars — pull-ups, dips, leg raises, push-ups, muscle-ups',
      location: 'outdoor',
    },
    {
      name: 'Skateboarding',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Continuous skating for 45 min, balance and core intensive',
      location: 'outdoor',
    },
    {
      name: 'Hiking',
      type: 'cardio',
      muscleGroup: 'full body',
      desc: 'Trail or hill hike at brisk pace, nature and cardio combined',
      location: 'outdoor',
    },
  ],
}
