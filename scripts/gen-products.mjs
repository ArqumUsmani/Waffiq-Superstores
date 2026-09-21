/**
 * Expands the compact catalogue below into src/data/products.json.
 *
 * Entries are pipe-delimited so the catalogue stays editable by hand:
 *   name | brand | size | urduNameOverride | tags(comma separated)
 *
 * Only `name`, `brand` and `size` are required. When the real Wafiq
 * catalogue arrives, replace CATALOGUE and re-run `npm run gen:data` —
 * the emitted schema stays identical.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = resolve(root, 'src/data');

const CATALOGUE = {
  'fresh-fruits': [
    'Sindhri Mango|Sindh|1 kg|سندھڑی آم|popular',
    'Chaunsa Mango|Punjab|1 kg|چونسا آم',
    'Kinnow|Punjab|1 kg|کینو|popular',
    'Banana|Local|Dozen|کیلا',
    'Red Apple|Imported|1 kg|سرخ سیب',
    'Seedless Watermelon|Local|1 piece|بغیر بیج تربوز',
  ],
  'fresh-vegetables': [
    'Tomato|Local|1 kg|ٹماٹر|popular',
    'Onion|Local|1 kg|پیاز|popular',
    'Potato|Local|1 kg|آلو',
    'Green Chilli|Local|250 g|ہری مرچ',
    'Capsicum|Local|1 kg|شملہ مرچ',
    'Cucumber|Local|1 kg|کھیرا',
  ],
  'herbs-leafy-greens': [
    'Coriander Bunch|Local|Bunch|دھنیا',
    'Mint Bunch|Local|Bunch|پودینہ',
    'Spinach|Local|Bunch|پالک',
    'Fenugreek Leaves|Local|Bunch|میتھی',
    'Spring Onion|Local|Bunch|ہری پیاز',
  ],
  'dried-fruits-nuts': [
    'Kabuli Almonds|Afghan|500 g|کابلی بادام|popular',
    'Kabuli Pine Nuts|Afghan|250 g|کابلی چلغوزہ',
    'Aseel Dates|Sindh|500 g|اصیل کھجور',
    'Walnuts|Balochistan|500 g|اخروٹ',
    'Kabuli Raisins|Afghan|250 g|کابلی کشمش',
    'Pistachios|Imported|250 g|پستہ',
  ],
  'cookies-biscuits': [
    'Peek Freans Sooper Biscuits|Peek Freans|Family Pack||popular',
    'LU Tuc Crackers|LU|Snack Pack',
    'LU Prince Chocolate Biscuits|LU|Family Pack',
    'Peek Freans Gluco Biscuits|Peek Freans|Half Roll',
    'Bisconni Chocolate Chip Cookies|Bisconni|Party Pack||popular',
    'Peek Freans Rio Sandwich|Peek Freans|Half Roll',
  ],
  'candies-jellies': [
    'Hilal Ding Dong Bubble Gum|Hilal|Jar of 100',
    'Hilal Chocomax Toffee|Hilal|Pouch 200 g',
    'Candyland Jelly Bites|Candyland|Pouch 120 g',
    'Hilal Super Pop Lollipop|Hilal|Jar of 50',
    'Candyland Fanty Jelly|Candyland|Pouch 150 g',
  ],
  chocolates: [
    'Cadbury Dairy Milk|Cadbury|65 g||popular',
    'Kit Kat 4 Finger|Nestlé|41.5 g',
    'Snickers Bar|Mars|50 g',
    'Cadbury Perk|Cadbury|35 g',
    'Galaxy Smooth Milk|Mars|40 g',
  ],
  'protein-bars': [
    'Quaker Oats Protein Bar|Quaker|60 g',
    'Nature Valley Crunchy Granola Bar|Nature Valley|42 g',
    'Kind Nut & Dark Chocolate Bar|Kind|40 g',
    'Nestlé Fitness Cereal Bar|Nestlé|23.5 g',
  ],

  'tea-sweeteners': [
    'Tapal Danedar Black Tea|Tapal|450 g||popular',
    'Lipton Yellow Label Tea|Lipton|475 g',
    'Tapal Mezban Family Mixture|Tapal|950 g',
    'Supreme Tea|Tapal|430 g',
    'Canderel Sweetener Tablets|Canderel|100 tablets',
    'Vital Green Tea Bags|Vital|30 bags',
  ],
  coffee: [
    'Nescafé Classic|Nescafé|100 g||popular',
    'Nescafé 3-in-1 Sachets|Nescafé|Pack of 24',
    'Nescafé Gold Blend|Nescafé|100 g',
    'Davidoff Rich Aroma|Davidoff|100 g',
    'Nescafé Xpress Canned Coffee|Nescafé|240 ml',
  ],
  'cereals-porridge': [
    'Nestlé Nido Fortified|Nestlé|900 g||popular',
    'Nestlé Koko Krunch|Nestlé|330 g',
    "Kellogg's Corn Flakes|Kellogg's|275 g",
    'Quaker Oats|Quaker|500 g',
    'Nestlé Cerelac Wheat|Nestlé|350 g',
    'Nestlé Milo Powder|Nestlé|400 g',
  ],
  'spreads-honey-jams': [
    "Young's Peanut Butter Creamy|Young's|340 g",
    'National Mixed Fruit Jam|National|440 g',
    'Marhaba Natural Honey|Marhaba|500 g',
    'Nutella Hazelnut Spread|Nutella|350 g||popular',
    "Young's Strawberry Jam|Young's|450 g",
  ],

  'packed-milk': [
    "Olper's Full Cream Milk|Olper's|1 L||popular",
    'Milkpak Full Cream Milk|Nestlé|1 L',
    'Haleeb Full Cream Milk|Haleeb|1 L',
    'Day Fresh Fresh Milk|Day Fresh|1 L',
    'Good Milk Full Cream|Good Milk|1 L',
    "Olper's Tarrka Cooking Milk|Olper's|1 L",
  ],
  'powdered-milk': [
    'Nido Fortigrow Milk Powder|Nestlé|800 g',
    'Everyday Tea Whitener|Nestlé|900 g||popular',
    "Olper's Dairy Cream Whitener|Olper's|1 kg",
    'Nespray Fortified Milk Powder|Nestlé|900 g',
    'Lactogen 1 Infant Formula|Nestlé|400 g',
  ],
  'condensed-milk': [
    'Nestlé Milkmaid|Nestlé|390 g||popular',
    'Haleeb Condensed Milk|Haleeb|390 g',
    "Young's Condensed Milk|Young's|390 g",
    'Nurpur Condensed Milk|Nurpur|390 g',
  ],
  'soft-drinks': [
    'Coca-Cola|Coca-Cola|1.5 L||popular',
    'Pepsi|Pepsi|1.5 L',
    'Sprite|Coca-Cola|1.5 L',
    '7UP|Pepsi|1.5 L',
    'Tang Orange Powder Drink|Tang|750 g',
    'Rooh Afza Sharbat|Hamdard|800 ml||popular',
  ],

  'powdered-masalas': [
    'Shan Biryani Masala|Shan|65 g||popular',
    'Shan Karahi Gosht Masala|Shan|50 g',
    'National Chicken Tikka Masala|National|50 g',
    'National Red Chilli Powder|National|200 g',
    'Mehran Haleem Masala|Mehran|300 g',
    'Shan Chaat Masala|Shan|100 g',
  ],
  'sauces-syrups': [
    'Knorr Chilli Garlic Sauce|Knorr|300 ml',
    "Mitchell's Chocolate Syrup|Mitchell's|450 g",
    'National Synthetic Vinegar|National|800 ml',
    "Young's Mayo Garlic|Young's|500 ml||popular",
    'Shezan Mango Squash|Shezan|800 ml',
  ],
  'noodles-pasta': [
    'Maggi 2-Minute Noodles Chicken|Maggi|4-pack||popular',
    'Knorr Noodles Masala|Knorr|4-pack',
    'Kolson Elbow Macaroni|Kolson|400 g',
    'Bake Parlor Spaghetti|Bake Parlor|400 g',
    'Kolson Vermicelli|Kolson|150 g',
  ],
  'baking-desserts': [
    'Rafhan Custard Powder Vanilla|Rafhan|275 g||popular',
    'Rafhan Jelly Strawberry|Rafhan|80 g',
    'National Kheer Mix|National|155 g',
    'Rafhan Corn Flour|Rafhan|300 g',
    'Bake Parlor Falooda Sev|Bake Parlor|150 g',
    'Blue Bird Baking Powder|Blue Bird|100 g',
  ],

  'pickles-ketchups': [
    'National Mixed Pickle in Oil|National|1 kg||popular',
    'Shangrila Tomato Ketchup|Shangrila|800 g',
    'National Tomato Ketchup|National|800 g',
    'Ahmed Mango Pickle|Ahmed|400 g',
    "Young's French Mustard|Young's|300 g",
  ],
  'spreads-chinese-sauces': [
    "Young's Sandwich Spread|Young's|300 ml",
    'Knorr Soy Sauce|Knorr|500 ml||popular',
    'Shangrila Hot & Sour Sauce|Shangrila|300 ml',
    'National Chilli Sauce|National|300 ml',
    "Young's Thousand Island Dressing|Young's|300 ml",
  ],
  'canned-fruit-veg': [
    'Del Monte Pineapple Slices|Del Monte|565 g||popular',
    'American Garden Red Kidney Beans|American Garden|400 g',
    'Del Monte Whole Kernel Corn|Del Monte|410 g',
    'National Baked Beans|National|420 g',
    'Green Giant Sweet Corn|Green Giant|340 g',
  ],
  'mushrooms-olives-oils': [
    'Dalda Cooking Oil|Dalda|5 L||popular',
    'Sufi Sunflower Oil|Sufi|5 L',
    'Figaro Olive Oil|Figaro|500 ml',
    'Del Monte Button Mushrooms|Del Monte|400 g',
    'Italia Green Olives|Italia|350 g',
  ],

  'tissues-foils': [
    'Rose Petal Facial Tissues|Rose Petal|150 pulls||popular',
    'Rose Petal Kitchen Towel|Rose Petal|2 rolls',
    'Homez Aluminium Foil Roll|Homez|9 m',
    'Scotch Cellophane Tape|Scotch|Pack of 6',
    'Rose Petal Toilet Rolls|Rose Petal|6 rolls',
  ],
  'lighters-matches': [
    'Chand Safety Match Box|Chand|Pack of 10',
    'Zorro Refillable Gas Lighter|Zorro|1 piece',
    'Zorro Long Kitchen Lighter|Zorro|1 piece',
    'Cricket Pocket Lighter|Cricket|Pack of 3',
  ],
  'storage-wraps': [
    'Homez Cling Film Food Wrap|Homez|30 m',
    'Lock & Lock Airtight Containers|Lock & Lock|Set of 3||popular',
    'Scotch-Brite Scrub Sponge|Scotch-Brite|Pack of 3',
    'Homez Zip Lock Freezer Bags|Homez|Pack of 25',
    'Appollo Plastic Lunch Box|Appollo|1.2 L',
  ],
  'dish-washing': [
    'Vim Dishwash Bar|Vim|300 g||popular',
    'Vim Dishwash Liquid Lemon|Vim|750 ml',
    'Max Dishwash Gel|Max|500 ml',
    'Finish Dishwasher Tablets|Finish|Pack of 30',
  ],

  'toilet-cleaning': [
    'Harpic Power Plus Toilet Cleaner|Harpic|1 L||popular',
    'Harpic Flushmatic Rim Block|Harpic|50 g',
    'Domex Toilet Cleaner|Domex|500 ml',
    'Homez Toilet Brush with Holder|Homez|1 piece',
  ],
  'washing-cleaning': [
    'Surf Excel Washing Powder|Surf Excel|1 kg||popular',
    'Ariel Washing Powder|Ariel|1 kg',
    'Bonus Detergent Powder|Bonus|1 kg',
    'Comfort Fabric Conditioner|Comfort|800 ml',
    'Robin Blue Whitener|Robin|Pack of 6',
    'Surf Excel Liquid Detergent|Surf Excel|1 L',
  ],
  'insect-killers': [
    'Mortein Cockroach Killer Spray|Mortein|400 ml||popular',
    'Mortein Mosquito Coil|Mortein|Pack of 10',
    'Mortein Peaceful Nights Refill|Mortein|45 ml',
    'Finis Insect Killer Spray|Finis|300 ml',
  ],
  'air-fresheners': [
    'Air Wick Freshmatic Refill|Air Wick|250 ml',
    'Glade Automatic Spray|Glade|175 g||popular',
    'Odonil Room Freshener Block|Odonil|50 g',
    'Air Wick Aerosol Lavender|Air Wick|300 ml',
  ],

  diapers: [
    'Pampers Baby Dry Medium|Pampers|Pack of 46||popular',
    'Canbebe Comfort Dry Large|Canbebe|Pack of 36',
    'Molfix Pants Extra Large|Molfix|Pack of 30',
    'Huggies Dry Small|Huggies|Pack of 60',
    'Pampers Newborn|Pampers|Pack of 28',
  ],
  'baby-care': [
    "Johnson's Baby Shampoo|Johnson's|200 ml||popular",
    "Johnson's Baby Powder|Johnson's|200 g",
    "Johnson's Baby Lotion|Johnson's|200 ml",
    'Pampers Baby Wipes|Pampers|Pack of 64',
    'Chicco Baby Soap|Chicco|75 g',
  ],
  'hair-removal': [
    'Veet Hair Removal Cream Normal|Veet|100 ml||popular',
    'Veet Cold Wax Strips|Veet|Pack of 20',
    'Gillette Venus Razor|Gillette|1 piece',
    'Anne French Hair Removing Lotion|Anne French|120 ml',
  ],
  'sanitary-pads': [
    'Always Ultra Thin Long|Always|Pack of 16||popular',
    'Butterfly Cottony Soft|Butterfly|Pack of 10',
    'Always Maxi Thick|Always|Pack of 20',
    'Butterfly Breathable Ultra|Butterfly|Pack of 8',
  ],

  'shampoos-soaps': [
    'Head & Shoulders Anti-Dandruff|Head & Shoulders|360 ml||popular',
    'Pantene Silky Smooth Care|Pantene|400 ml',
    'Sunsilk Black Shine|Sunsilk|340 ml',
    'Lux Soft Touch Soap|Lux|Pack of 3',
    'Safeguard Pure White Soap|Safeguard|Pack of 3||popular',
    'Dettol Original Soap|Dettol|Pack of 3',
  ],
  'oral-care': [
    'Colgate Maximum Cavity Protection|Colgate|200 g||popular',
    'Sensodyne Fresh Mint|Sensodyne|100 g',
    'Close Up Red Hot|Close Up|140 g',
    'Oral-B All Rounder Toothbrush|Oral-B|Pack of 2',
    'Colgate ZigZag Toothbrush|Colgate|Pack of 3',
  ],
  'handwash-baby-oils': [
    'Dettol Original Handwash Refill|Dettol|900 ml||popular',
    'Lifebuoy Total 10 Handwash|Lifebuoy|200 ml',
    "Johnson's Baby Oil|Johnson's|200 ml",
    'Safeguard Handwash Lemon|Safeguard|220 ml',
    'Dettol Skincare Handwash|Dettol|200 ml',
  ],
  'intimate-care': [
    'Dettol Intimate Wash|Dettol|120 ml',
    'Veet Sensitive Intimate Wipes|Veet|Pack of 12',
    'Lifebuoy Hygiene Wash|Lifebuoy|180 ml',
    'Always Daily Liners|Always|Pack of 20',
  ],
};

/**
 * Urdu transliterations for the brands stocked above. Loose produce has no
 * real brand, so its "brand" field is an origin (Sindh, Local, Afghan…)
 * used the way a physical produce bin is labelled — these get translated
 * here too, though every produce row also carries an explicit `urOverride`
 * for the full product name.
 */
const BRAND_UR = {
  Sindh: 'سندھ', Punjab: 'پنجاب', Balochistan: 'بلوچستان', Afghan: 'افغان',
  Local: 'مقامی', Imported: 'درآمدی',
  'Peek Freans': 'پیک فرینز', LU: 'ایل یو', Bisconni: 'بسکونی', Hilal: 'ہلال',
  Candyland: 'کینڈی لینڈ', Cadbury: 'کیڈبری', Nestlé: 'نیسلے', Mars: 'مارس',
  Quaker: 'کوکر', 'Nature Valley': 'نیچر ویلی', Kind: 'کائنڈ', Tapal: 'ٹپال',
  Lipton: 'لپٹن', Canderel: 'کینڈرل', Vital: 'وائٹل', Nescafé: 'نیسکافے',
  Davidoff: 'ڈیوی ڈوف', "Kellogg's": 'کیلاگز', "Young's": 'ینگز', National: 'نیشنل',
  Marhaba: 'مرحبا', Nutella: 'نیوٹیلا', "Olper's": 'اولپرز', Haleeb: 'حلیب',
  'Day Fresh': 'ڈے فریش', 'Good Milk': 'گڈ ملک', Nurpur: 'نور پور',
  'Coca-Cola': 'کوکا کولا', Pepsi: 'پیپسی', Tang: 'ٹینگ', Hamdard: 'ہمدرد',
  Shan: 'شان', Mehran: 'مہران', Knorr: 'نار', "Mitchell's": 'مچلز',
  Shezan: 'شیزان', Maggi: 'میگی', Kolson: 'کولسن', 'Bake Parlor': 'بیک پارلر',
  Rafhan: 'رفحان', 'Blue Bird': 'بلیو برڈ', Shangrila: 'شنگریلا', Ahmed: 'احمد',
  'Del Monte': 'ڈیل مونٹے', 'American Garden': 'امریکن گارڈن', 'Green Giant': 'گرین جائنٹ',
  Dalda: 'دالدا', Sufi: 'صوفی', Figaro: 'فگارو', Italia: 'اٹالیا',
  'Rose Petal': 'روز پیٹل', Homez: 'ہومز', Scotch: 'اسکاچ', Chand: 'چاند',
  Zorro: 'زورو', Cricket: 'کرکٹ', 'Lock & Lock': 'لاک اینڈ لاک',
  'Scotch-Brite': 'اسکاچ برائٹ', Appollo: 'اپالو', Vim: 'ویم', Max: 'میکس',
  Finish: 'فنش', Harpic: 'ہارپک', Domex: 'ڈومیکس', 'Surf Excel': 'سرف ایکسل',
  Ariel: 'ایریل', Bonus: 'بونس', Comfort: 'کمفرٹ', Robin: 'روبن',
  Mortein: 'مورٹین', Finis: 'فنس', 'Air Wick': 'ایئر وک', Glade: 'گلیڈ',
  Odonil: 'اوڈونل', Pampers: 'پیمپرز', Canbebe: 'کین بے بے', Molfix: 'مولفکس',
  Huggies: 'ہگیز', "Johnson's": 'جانسنز', Chicco: 'چیکو', Veet: 'ویٹ',
  Gillette: 'جیلیٹ', 'Anne French': 'این فرینچ', Always: 'آلویز', Butterfly: 'بٹرفلائی',
  'Head & Shoulders': 'ہیڈ اینڈ شولڈرز', Pantene: 'پینٹین', Sunsilk: 'سن سلک',
  Lux: 'لکس', Safeguard: 'سیف گارڈ', Dettol: 'ڈیٹول', Colgate: 'کولگیٹ',
  Sensodyne: 'سینسوڈائن', 'Close Up': 'کلوز اپ', 'Oral-B': 'اورل بی',
  Lifebuoy: 'لائف بوائے',
};

/** Urdu noun + English one-liner per subcategory, plus the tile glyph. */
const SUB_META = {
  'fresh-fruits': ['پھل', 'fruit', 'Seasonal fruit, picked fresh and priced by the kilo.'],
  'fresh-vegetables': ['سبزی', 'vegetable', 'The daily vegetable basket — onions, tomatoes and the rest of the list.'],
  'herbs-leafy-greens': ['ہری سبزی', 'leaf', 'Coriander, mint and leafy greens sold by the bunch.'],
  'dried-fruits-nuts': ['خشک میوہ', 'nut', 'Almonds, dates and dried fruit for snacking and desserts.'],
  'cookies-biscuits': ['بسکٹ', 'cookie', 'Tea-time biscuits and cookies from the brands people ask for by name.'],
  'candies-jellies': ['ٹافی', 'candy', 'Sweets for the counter jar — toffees, jellies, lollipops and gum.'],
  chocolates: ['چاکلیٹ', 'chocolate', 'Chocolate bars kept cool and stocked all year round.'],
  'protein-bars': ['پروٹین بار', 'bar', 'Grab-and-go bars for gym bags, lunch boxes and long drives.'],
  'tea-sweeteners': ['چائے', 'cup', 'Loose tea, tea bags and sweeteners for the daily chai.'],
  coffee: ['کافی', 'cup', 'Instant coffee, sachets and ready-to-drink cans.'],
  'cereals-porridge': ['سیریل', 'cereal', 'Breakfast cereals, oats, porridge and fortified milk powders.'],
  'spreads-honey-jams': ['جام', 'jar', 'What goes on the toast — peanut butter, honey and fruit jams.'],
  'packed-milk': ['دودھ', 'carton', 'Tetra-packed milk in full cream, cooking and fresh varieties.'],
  'powdered-milk': ['دودھ پاؤڈر', 'tin', 'Milk powders, tea whiteners and infant formula.'],
  'condensed-milk': ['کنڈنسڈ دودھ', 'tin', 'Sweetened condensed milk for desserts and chai.'],
  'soft-drinks': ['مشروب', 'bottle', 'Bottled soft drinks, sharbats and powdered drink mixes.'],
  'powdered-masalas': ['مصالحہ', 'spice', 'Recipe masalas and single spices for everyday cooking.'],
  'sauces-syrups': ['ساس', 'bottle', 'Sauces, squashes, syrups and finishing touches.'],
  'noodles-pasta': ['نوڈلز', 'noodles', 'Instant noodles, vermicelli, macaroni and spaghetti.'],
  'baking-desserts': ['میٹھا', 'whisk', 'Custard, jelly, kheer mixes and the basics for baking.'],
  'pickles-ketchups': ['اچار', 'jar', 'Pickles in oil, ketchups, vinegars and mustards.'],
  'spreads-chinese-sauces': ['ساس', 'bottle', 'Sandwich spreads, mayo and the Chinese sauce shelf.'],
  'canned-fruit-veg': ['ڈبہ بند', 'can', 'Tinned fruit, beans and corn for the store cupboard.'],
  'mushrooms-olives-oils': ['تیل', 'oil', 'Cooking oils, olive oil, olives and tinned mushrooms.'],
  'tissues-foils': ['ٹشو', 'tissue', 'Tissues, kitchen towels, foils and tapes.'],
  'lighters-matches': ['ماچس', 'flame', 'Match boxes and refillable kitchen lighters.'],
  'storage-wraps': ['ریپ', 'box', 'Airtight containers, cling film, freezer bags and sponges.'],
  'dish-washing': ['برتن صابن', 'dish', 'Dishwash bars, liquids, gels and machine tablets.'],
  'toilet-cleaning': ['ٹوائلٹ کلینر', 'spray', 'Toilet cleaners, rim blocks and brushes.'],
  'washing-cleaning': ['واشنگ پاؤڈر', 'detergent', 'Washing powders, liquid detergents and fabric conditioners.'],
  'insect-killers': ['کیڑے مار', 'spray', 'Sprays, coils and liquid refills for mosquitoes and roaches.'],
  'air-fresheners': ['ایئر فریشنر', 'spray', 'Automatic sprays, aerosols and room freshener blocks.'],
  diapers: ['ڈایپر', 'baby', 'Taped and pant-style diapers in every size.'],
  'baby-care': ['بے بی کیئر', 'baby', 'Gentle shampoos, lotions, powders, wipes and soaps.'],
  'hair-removal': ['بال صفا', 'razor', 'Creams, wax strips, razors and removal lotions.'],
  'sanitary-pads': ['پیڈ', 'pad', 'Ultra-thin, maxi and breathable pads in multiple counts.'],
  'shampoos-soaps': ['شیمپو', 'bottle-pump', 'Shampoos, conditioners and bathing soaps.'],
  'oral-care': ['ٹوتھ پیسٹ', 'tooth', 'Toothpastes for every sensitivity, plus brushes.'],
  'handwash-baby-oils': ['ہینڈ واش', 'bottle-pump', 'Liquid hand washes, refills and baby oils.'],
  'intimate-care': ['نجی نگہداشت', 'bottle-pump', 'Discreet intimate washes, wipes and daily liners.'],
};

/** Stable 32-bit hash so tile hues never shift between builds. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const categories = JSON.parse(await readFile(resolve(DATA, 'categories.json'), 'utf8'));

const subToCategory = new Map();
for (const cat of categories) {
  for (const sub of cat.subcategories) subToCategory.set(sub.slug, cat);
}

// A real photo, or a tile already rasterised by gen-product-tiles.mjs,
// is real work either way — re-running this script over an edited
// catalogue should never silently throw that away. Carried over by
// SKU; a SKU that no longer exists just drops out with the row it
// belonged to.
const previousImageBySku = new Map();
try {
  const previous = JSON.parse(await readFile(resolve(DATA, 'products.json'), 'utf8'));
  for (const p of previous) if (p.image) previousImageBySku.set(p.sku, p.image);
} catch {
  /* first run — nothing to carry over yet */
}

const products = [];
const seen = new Set();

for (const [subSlug, rows] of Object.entries(CATALOGUE)) {
  const cat = subToCategory.get(subSlug);
  if (!cat) throw new Error(`Unknown subcategory in CATALOGUE: ${subSlug}`);

  const meta = SUB_META[subSlug];
  if (!meta) throw new Error(`Missing SUB_META entry for: ${subSlug}`);
  const [urNoun, glyph, blurb] = meta;

  for (const row of rows) {
    const [name, brand, size, urOverride = '', tagStr = ''] = row.split('|');
    let sku = `${subSlug}-${slugify(name)}`;
    if (seen.has(sku)) sku = `${sku}-${products.length}`;
    seen.add(sku);

    const brandUr = BRAND_UR[brand];
    if (!brandUr) console.warn(`  ! no Urdu transliteration for brand "${brand}"`);

    products.push({
      sku,
      name,
      nameUr: urOverride || `${brandUr ?? brand} ${urNoun}`,
      brand,
      category: cat.slug,
      subcategory: subSlug,
      size,
      desc: blurb,
      tags: tagStr ? tagStr.split(',') : [],
      tile: { hue: hash(sku) % 360, glyph },
      image: previousImageBySku.get(sku) ?? null,
    });
  }
}

await writeFile(resolve(DATA, 'products.json'), `${JSON.stringify(products, null, 2)}\n`, 'utf8');

const perCat = categories.map(
  (c) => `  ${c.en}: ${products.filter((p) => p.category === c.slug).length}`,
);
const withImage = products.filter((p) => p.image).length;
console.log(`Wrote ${products.length} products to src/data/products.json`);
console.log(perCat.join('\n'));
if (withImage < products.length) {
  console.log(`\n${products.length - withImage} product(s) have no image yet — run npm run gen:tiles.`);
}
