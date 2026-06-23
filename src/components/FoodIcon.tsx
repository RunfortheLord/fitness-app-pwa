import {
  Apple,
  Banana,
  Bean,
  Beef,
  Beer,
  Cake,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Egg,
  Fish,
  Grape,
  Ham,
  IceCream,
  Milk,
  Nut,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  Wheat,
  Wine,
  type LucideIcon,
} from 'lucide-react'

import { foodIconKey, type FoodIconKey } from '@domain/foodIcons'

const ICONS: Record<FoodIconKey, LucideIcon> = {
  poultry: Drumstick,
  beef: Beef,
  pork: Ham,
  fish: Fish,
  egg: Egg,
  dairy: Milk,
  grain: Wheat,
  bread: Croissant,
  banana: Banana,
  apple: Apple,
  grape: Grape,
  citrus: Citrus,
  cherry: Cherry,
  vegetable: Carrot,
  bean: Bean,
  nut: Nut,
  soup: Soup,
  salad: Salad,
  sandwich: Sandwich,
  pizza: Pizza,
  bar: Candy,
  cookie: Cookie,
  cake: Cake,
  candy: Candy,
  donut: Donut,
  icecream: IceCream,
  popcorn: Popcorn,
  coffee: Coffee,
  soda: CupSoda,
  wine: Wine,
  beer: Beer,
  default: Utensils,
}

export function FoodIcon({
  name,
  category,
  size = 18,
}: {
  name: string
  category?: string | null
  size?: number
}) {
  const Icon = ICONS[foodIconKey(name, category)]
  return <Icon aria-hidden="true" size={size} />
}
