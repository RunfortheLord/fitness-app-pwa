import { normalizeFoodText } from '@domain/foodProviderModels'

/**
 * A small set of food category icons used to give each food a recognizable
 * visual on the left of search results and food lists. This intentionally maps
 * foods to a representative category icon (keyword based) rather than bundling
 * per-product artwork, which keeps the PWA small, offline, and license-clean.
 */
export type FoodIconKey =
  | 'poultry'
  | 'beef'
  | 'pork'
  | 'fish'
  | 'egg'
  | 'dairy'
  | 'grain'
  | 'bread'
  | 'banana'
  | 'apple'
  | 'grape'
  | 'citrus'
  | 'cherry'
  | 'vegetable'
  | 'bean'
  | 'nut'
  | 'soup'
  | 'salad'
  | 'sandwich'
  | 'pizza'
  | 'bar'
  | 'cookie'
  | 'cake'
  | 'candy'
  | 'donut'
  | 'icecream'
  | 'popcorn'
  | 'coffee'
  | 'soda'
  | 'wine'
  | 'beer'
  | 'default'

// Ordered by priority: prepared dishes and specific items are matched before
// broader categories so e.g. "chicken noodle soup" resolves to soup.
const ICON_RULES: Array<{ key: FoodIconKey; keywords: string[] }> = [
  { key: 'pizza', keywords: ['pizza'] },
  {
    key: 'sandwich',
    keywords: [
      'sandwich',
      'sandwiches',
      'burger',
      'burgers',
      'hamburger',
      'cheeseburger',
      'wrap',
      'wraps',
      'sub',
      'burrito',
      'taco',
      'tacos',
      'quesadilla',
      'hotdog',
      'panini',
    ],
  },
  { key: 'salad', keywords: ['salad', 'salads', 'slaw'] },
  {
    key: 'soup',
    keywords: ['soup', 'soups', 'stew', 'broth', 'chowder', 'bisque'],
  },
  { key: 'egg', keywords: ['egg', 'eggs', 'omelet', 'omelette', 'frittata'] },
  {
    key: 'poultry',
    keywords: [
      'chicken',
      'turkey',
      'poultry',
      'drumstick',
      'wing',
      'wings',
      'rotisserie',
    ],
  },
  { key: 'beef', keywords: ['beef', 'steak', 'sirloin', 'ribeye', 'brisket'] },
  {
    key: 'pork',
    keywords: ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pepperoni'],
  },
  {
    key: 'fish',
    keywords: [
      'fish',
      'salmon',
      'tuna',
      'cod',
      'tilapia',
      'shrimp',
      'seafood',
      'sardine',
      'sardines',
      'crab',
      'lobster',
    ],
  },
  {
    key: 'coffee',
    keywords: [
      'coffee',
      'espresso',
      'latte',
      'cappuccino',
      'mocha',
      'americano',
    ],
  },
  { key: 'soda', keywords: ['soda', 'cola', 'pop'] },
  { key: 'wine', keywords: ['wine'] },
  { key: 'beer', keywords: ['beer', 'ale', 'lager', 'ipa'] },
  {
    key: 'dairy',
    keywords: [
      'milk',
      'yogurt',
      'yoghurt',
      'cream',
      'cheese',
      'cheddar',
      'mozzarella',
      'butter',
      'smoothie',
      'shake',
    ],
  },
  { key: 'icecream', keywords: ['icecream', 'gelato', 'sorbet'] },
  { key: 'donut', keywords: ['donut', 'donuts', 'doughnut', 'doughnuts'] },
  { key: 'cookie', keywords: ['cookie', 'cookies', 'biscuit', 'biscuits'] },
  {
    key: 'cake',
    keywords: [
      'cake',
      'cakes',
      'cupcake',
      'muffin',
      'brownie',
      'pie',
      'pastry',
      'pastries',
      'dessert',
    ],
  },
  { key: 'candy', keywords: ['candy', 'chocolate', 'gummy', 'sweets'] },
  {
    key: 'popcorn',
    keywords: [
      'popcorn',
      'chips',
      'crackers',
      'cracker',
      'pretzel',
      'pretzels',
      'snack',
    ],
  },
  { key: 'bar', keywords: ['bar', 'bars'] },
  {
    key: 'bread',
    keywords: [
      'bread',
      'toast',
      'bagel',
      'roll',
      'rolls',
      'bun',
      'buns',
      'croissant',
    ],
  },
  {
    key: 'grain',
    keywords: [
      'rice',
      'pasta',
      'spaghetti',
      'noodle',
      'noodles',
      'macaroni',
      'oat',
      'oats',
      'oatmeal',
      'cereal',
      'granola',
      'quinoa',
      'barley',
      'grain',
      'grains',
      'wheat',
    ],
  },
  { key: 'banana', keywords: ['banana', 'bananas', 'plantain'] },
  { key: 'apple', keywords: ['apple', 'apples'] },
  { key: 'grape', keywords: ['grape', 'grapes', 'raisin', 'raisins'] },
  {
    key: 'citrus',
    keywords: [
      'orange',
      'oranges',
      'lemon',
      'lime',
      'citrus',
      'grapefruit',
      'tangerine',
    ],
  },
  {
    key: 'cherry',
    keywords: [
      'cherry',
      'cherries',
      'berry',
      'berries',
      'strawberry',
      'strawberries',
      'blueberry',
      'blueberries',
      'raspberry',
    ],
  },
  {
    key: 'apple',
    keywords: [
      'fruit',
      'peach',
      'pear',
      'mango',
      'melon',
      'watermelon',
      'pineapple',
      'kiwi',
    ],
  },
  {
    key: 'vegetable',
    keywords: [
      'carrot',
      'carrots',
      'vegetable',
      'vegetables',
      'broccoli',
      'spinach',
      'lettuce',
      'pepper',
      'peppers',
      'onion',
      'onions',
      'tomato',
      'tomatoes',
      'cucumber',
      'celery',
      'kale',
      'potato',
      'potatoes',
    ],
  },
  {
    key: 'bean',
    keywords: [
      'bean',
      'beans',
      'lentil',
      'lentils',
      'chickpea',
      'chickpeas',
      'hummus',
      'tofu',
      'edamame',
    ],
  },
  {
    key: 'nut',
    keywords: [
      'nut',
      'nuts',
      'almond',
      'almonds',
      'peanut',
      'peanuts',
      'cashew',
      'cashews',
      'walnut',
      'walnuts',
      'pecan',
      'pistachio',
    ],
  },
]

export function foodIconKey(
  name: string,
  category?: string | null,
): FoodIconKey {
  const haystack = normalizeFoodText(`${name} ${category ?? ''}`)
  if (!haystack) {
    return 'default'
  }
  for (const rule of ICON_RULES) {
    // Keywords are a static local list and each value is escaped before use.
    // eslint-disable-next-line security/detect-non-literal-regexp
    const pattern = new RegExp(
      `\\b(${rule.keywords.map(escapeRegExp).join('|')})\\b`,
      'u',
    )
    if (pattern.test(haystack)) {
      return rule.key
    }
  }
  return 'default'
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
