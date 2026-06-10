// Emoji intake quiz -> the 12 clinical features the model expects.
// Each option sets explicit feature values (transparent, no hidden math). Eight
// friendly questions cover all 12 features; BMI (low importance, not asked) uses a
// population default. The assembled vector is ordered to match FEATURE_ORDER in model.js.

export const QUESTIONS = [
  {
    key: "companion",
    title: "Who will be staying with you?",
    hint: "This decides whether you need a single or a shared room.",
    options: [
      { icon: "user", label: "Just me",              set: { caretaker_present: 0 } },
      { icon: "users", label: "With a partner / carer", set: { caretaker_present: 1 } },
    ],
  },
  {
    key: "mood",
    title: "How have your spirits been lately?",
    hint: "Over the last couple of weeks.",
    options: [
      { icon: "smile", label: "Bright",      set: { phq9_depression: 2,  gad7_anxiety: 2 } },
      { icon: "meh", label: "Okay",        set: { phq9_depression: 8,  gad7_anxiety: 6 } },
      { icon: "frown", label: "Low",         set: { phq9_depression: 15, gad7_anxiety: 12 } },
      { icon: "frown", label: "Very low",    set: { phq9_depression: 22, gad7_anxiety: 17 } },
    ],
  },
  {
    key: "energy",
    title: "How is your energy?",
    options: [
      { icon: "zap", label: "Full of it",  set: { fatigue_score: 1 } },
      { icon: "battery", label: "Fine",        set: { fatigue_score: 4 } },
      { icon: "battery-medium", label: "Often tired", set: { fatigue_score: 7 } },
      { icon: "battery-low", label: "Exhausted",   set: { fatigue_score: 9 } },
    ],
  },
  {
    key: "sun",
    title: "How does bright sunshine feel to you?",
    options: [
      { icon: "sun", label: "Love it",        set: { sun_tolerance: 9, light_sensitivity: 1 } },
      { icon: "cloud-sun", label: "Pleasant",       set: { sun_tolerance: 6, light_sensitivity: 3 } },
      { icon: "cloud", label: "A bit much",     set: { sun_tolerance: 3, light_sensitivity: 6 } },
      { icon: "eye-off", label: "Too harsh",      set: { sun_tolerance: 1, light_sensitivity: 9 } },
    ],
  },
  {
    key: "outdoors",
    title: "How often are you out in daylight?",
    hint: "Daylight helps your vitamin D.",
    options: [
      { icon: "tree-pine", label: "Most days", set: { vitamin_d_ngml: 35 } },
      { icon: "footprints", label: "Sometimes", set: { vitamin_d_ngml: 22 } },
      { icon: "home", label: "Rarely",    set: { vitamin_d_ngml: 12 } },
    ],
  },
  {
    key: "movement",
    title: "Getting around is…",
    options: [
      { icon: "activity", label: "Easy",       set: { mobility_index: 95, pain_score: 1 } },
      { icon: "footprints", label: "Manageable", set: { mobility_index: 75, pain_score: 3 } },
      { icon: "accessibility", label: "Hard",       set: { mobility_index: 45, pain_score: 6 } },
      { icon: "accessibility", label: "Very hard",  set: { mobility_index: 20, pain_score: 8 } },
    ],
  },
  {
    key: "sleep",
    title: "How well do you sleep?",
    options: [
      { icon: "moon", label: "Like a log", set: { sleep_quality_psqi: 3 } },
      { icon: "cloud-moon", label: "So-so",      set: { sleep_quality_psqi: 8 } },
      { icon: "frown", label: "Poorly",     set: { sleep_quality_psqi: 14 } },
      { icon: "eye-off", label: "Barely",     set: { sleep_quality_psqi: 19 } },
    ],
  },
  {
    key: "age",
    title: "Which feels most like you?",
    options: [
      { icon: "baby", label: "Under 35", set: { age: 28 } },
      { icon: "user", label: "35 – 60",  set: { age: 48 } },
      { icon: "glasses", label: "Over 60",  set: { age: 70 } },
    ],
  },
];

// Defaults for anything a quiz option doesn't set.
const DEFAULTS = { bmi: 26 };

// Build the ordered feature vector from collected {feature: value} answers.
export function assembleFeatures(answers, featureOrder) {
  const merged = { ...DEFAULTS, ...answers };
  return featureOrder.map((f) => Number(merged[f]));
}
