import { boundedEditDistance, normalizeFoodText } from './foodProviderModels.js'

// A compact lexicon of common, frequently-misspelled food words. It exists ONLY
// to correct the spelling of a retry query when the provider returns nothing for
// a typo (e.g. USDA has no canonical result for "chiken"). It never injects
// foods, macros, or rankings — it just maps a misspelled token back to a real
// word so the provider can be queried again. Keep it to genuinely common terms;
// it is intentionally not an exhaustive dictionary.
const FOOD_LEXICON = new Set<string>([
  // proteins
  'chicken',
  'turkey',
  'beef',
  'steak',
  'pork',
  'bacon',
  'sausage',
  'salmon',
  'tuna',
  'shrimp',
  'tilapia',
  'cod',
  'halibut',
  'lobster',
  'crab',
  'meatball',
  'meatballs',
  'burger',
  'hamburger',
  'sandwich',
  'nugget',
  'nuggets',
  'tofu',
  'tempeh',
  // dairy and eggs
  'milk',
  'cheese',
  'cheddar',
  'mozzarella',
  'parmesan',
  'yogurt',
  'butter',
  'cream',
  'egg',
  'eggs',
  'omelet',
  // grains and bakery
  'rice',
  'pasta',
  'spaghetti',
  'macaroni',
  'noodle',
  'noodles',
  'bread',
  'bagel',
  'tortilla',
  'oatmeal',
  'oats',
  'cereal',
  'granola',
  'cracker',
  'crackers',
  'muffin',
  'pancake',
  'pancakes',
  'waffle',
  'waffles',
  'biscuit',
  'croissant',
  'quinoa',
  'couscous',
  'barley',
  // fruit
  'apple',
  'banana',
  'orange',
  'grape',
  'grapes',
  'strawberry',
  'strawberries',
  'blueberry',
  'blueberries',
  'raspberry',
  'pineapple',
  'mango',
  'peach',
  'pear',
  'watermelon',
  'cantaloupe',
  'avocado',
  'cherry',
  'cherries',
  'lemon',
  'lime',
  'coconut',
  // vegetables
  'broccoli',
  'spinach',
  'lettuce',
  'tomato',
  'tomatoes',
  'potato',
  'potatoes',
  'carrot',
  'carrots',
  'onion',
  'cucumber',
  'pepper',
  'peppers',
  'mushroom',
  'mushrooms',
  'cauliflower',
  'asparagus',
  'zucchini',
  'celery',
  'cabbage',
  'eggplant',
  'pumpkin',
  'squash',
  'garlic',
  // legumes and nuts
  'beans',
  'lentils',
  'chickpea',
  'chickpeas',
  'hummus',
  'peanut',
  'peanuts',
  'almond',
  'almonds',
  'cashew',
  'cashews',
  'walnut',
  'walnuts',
  'pistachio',
  'pistachios',
  // prepared / misc
  'pizza',
  'burrito',
  'taco',
  'quesadilla',
  'salad',
  'soup',
  'smoothie',
  'protein',
  'chocolate',
  'vanilla',
  'cookie',
  'cookies',
  'brownie',
  'pretzel',
  'pretzels',
  'popcorn',
  'ketchup',
  'mustard',
  'mayonnaise',
  'coffee',
  'espresso',
  'latte',
  'cappuccino',
])

// Minimum token length to consider for correction. Short tokens are too easily
// one edit from an unrelated word, so they are never auto-corrected.
const MIN_CORRECTION_LENGTH = 5

/**
 * Returns a spelling-corrected version of the query when exactly one token is an
 * obvious one-edit misspelling of a lexicon word, otherwise null. Conservative
 * by design: a token already in the lexicon is left alone, and an ambiguous
 * token (equidistant from several lexicon words) is not changed.
 */
export function correctFoodQuery(query: string): string | null {
  const normalized = normalizeFoodText(query)
  if (!normalized) {
    return null
  }
  const tokens = normalized.split(' ').filter(Boolean)
  let changed = false
  const corrected = tokens.map((token) => {
    if (token.length < MIN_CORRECTION_LENGTH || FOOD_LEXICON.has(token)) {
      return token
    }
    const matches: string[] = []
    for (const term of FOOD_LEXICON) {
      if (Math.abs(term.length - token.length) > 1) {
        continue
      }
      if (boundedEditDistance(token, term, 1) <= 1) {
        matches.push(term)
        if (matches.length > 1) {
          break
        }
      }
    }
    if (matches.length === 1) {
      changed = true
      return matches[0]
    }
    return token
  })
  return changed ? corrected.join(' ') : null
}
