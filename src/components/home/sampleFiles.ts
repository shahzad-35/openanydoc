import type { MiniFormat } from '../KitIcon'

// The three made-up files of the hero demo. Nothing here is real data: every name, number and line is invented.
export type SampleFile = { id: 'csv' | 'json' | 'txt'; name: string; format: MiniFormat }

export const sampleFiles: SampleFile[] = [
  { id: 'csv', name: 'sales-q3.csv', format: 'csv' },
  { id: 'json', name: 'products.json', format: 'json' },
  { id: 'txt', name: 'notes.txt', format: 'txt' },
]

export const SALES_COLUMNS = ['Region', 'Product', 'Units', 'Revenue', 'Month']

export const SALES_ROWS = [
  ['North', 'Notebook', '120', '540.00', 'Jul'],
  ['South', 'Pencil set', '340', '680.00', 'Jul'],
  ['East', 'Desk lamp', '45', '1,350.00', 'Jul'],
  ['West', 'Notebook', '98', '441.00', 'Jul'],
  ['North', 'Desk lamp', '52', '1,560.00', 'Aug'],
  ['South', 'Notebook', '150', '675.00', 'Aug'],
  ['East', 'Pencil set', '290', '580.00', 'Aug'],
  ['West', 'Desk lamp', '38', '1,140.00', 'Aug'],
  ['North', 'Pencil set', '410', '820.00', 'Sep'],
  ['South', 'Desk lamp', '61', '1,830.00', 'Sep'],
  ['East', 'Notebook', '133', '598.50', 'Sep'],
  ['West', 'Pencil set', '275', '550.00', 'Sep'],
]

export const PRODUCTS_JSON = {
  store: 'Demo Shop',
  currency: 'USD',
  products: [
    { id: 1, name: 'Notebook', price: 4.5, inStock: true },
    { id: 2, name: 'Pencil set', price: 2, inStock: true },
    { id: 3, name: 'Desk lamp', price: 30, inStock: false },
  ],
}

export const NOTES_LINES = [
  'Team notes, Monday',
  '',
  '- Finish the Q3 sales summary',
  '- Check the lamp supplier quote',
  '- Order more pencil sets before the fair',
  '- Book the room for Thursday',
  '',
  'Reminder: the shop closes early on Friday.',
]
