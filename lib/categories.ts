export const BLINKIT_CATEGORIES = [
  'groceries',
  'fresh produce',
  'dairy',
  'snacks',
  'beverages',
  'personal care',
  'cosmetics',
  'baby care',
  'pet supplies',
  'household/cleaning',
  'home & kitchen',
  'electronics accessories',
  'stationery',
  'pharmacy/wellness',
] as const

export type BlinkitCategory = (typeof BLINKIT_CATEGORIES)[number]

export const CATEGORY_SYNONYM_MAP: Record<string, BlinkitCategory> = {
  'dog food': 'pet supplies',
  'cat food': 'pet supplies',
  'pet food': 'pet supplies',
  diapers: 'baby care',
  'baby food': 'baby care',
  wipes: 'baby care',
  shampoo: 'personal care',
  soap: 'personal care',
  toothpaste: 'personal care',
  'skin care': 'cosmetics',
  makeup: 'cosmetics',
  lipsticks: 'cosmetics',
  milk: 'dairy',
  bread: 'dairy',
  curd: 'dairy',
  butter: 'dairy',
  veggies: 'fresh produce',
  vegetables: 'fresh produce',
  fruits: 'fresh produce',
  atta: 'groceries',
  rice: 'groceries',
  dal: 'groceries',
  oil: 'groceries',
  spices: 'groceries',
  chips: 'snacks',
  biscuits: 'snacks',
  chocolates: 'snacks',
  soda: 'beverages',
  juice: 'beverages',
  'cold drink': 'beverages',
  detergent: 'household/cleaning',
  cleaner: 'household/cleaning',
  charger: 'electronics accessories',
  cable: 'electronics accessories',
  earphones: 'electronics accessories',
  pen: 'stationery',
  notebook: 'stationery',
  medicine: 'pharmacy/wellness',
  vitamins: 'pharmacy/wellness',
}

export function normalizeMentionedCategory(input: string): string {
  const normalized = input.trim().toLowerCase()
  if (BLINKIT_CATEGORIES.includes(normalized as BlinkitCategory)) {
    return normalized
  }
  if (CATEGORY_SYNONYM_MAP[normalized]) {
    return CATEGORY_SYNONYM_MAP[normalized]
  }
  return input.trim()
}
