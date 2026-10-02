/**
 * Catalogue metadata shared by the product scripts: Urdu brand names, the
 * per-subcategory Urdu noun / tile glyph / one-line description, and the
 * stable helpers that turn names into SKUs and tile hues.
 *
 * gen-products.mjs (the hand-kept catalogue) and import-naheed.mjs (the
 * scraped one) both build products.json from these, so the two paths emit
 * the same schema with the same Urdu and the same SKUs.
 */
/**
 * Urdu transliterations for stocked brands. Loose produce has no
 * real brand, so its "brand" field is an origin (Sindh, Local, Afghan…)
 * used the way a physical produce bin is labelled — these get translated
 * here too, though every produce row also carries an explicit `urOverride`
 * for the full product name.
 */
export const BRAND_UR = {
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
  /* Added with the Naheed import. */
  Abena: 'ابینا', Almarai: 'المراعی', Astonish: 'ایسٹونش', 'B&B': 'بی اینڈ بی', Baygon: 'بیگون',
  Bodyform: 'باڈی فارم', Cif: 'سِف', Clorox: 'کلوروکس', Comelle: 'کومیل', Cosmee: 'کاسمی',
  Dabur: 'ڈابر', Diablo: 'ڈیابلو', Dove: 'ڈوو', Dupas: 'ڈوپاس', Elmore: 'ایلمور', Embrace: 'ایمبریس',
  Fairy: 'فیری', Fanta: 'فانٹا', Farlin: 'فارلن', Fruitamins: 'فروٹامنز', Fute: 'فیوٹ',
  Glinter: 'گلنٹر', Heinz: 'ہائنز', Hiclean: 'ہائی کلین', Kinder: 'کنڈر', Kinza: 'کنزا',
  Klassno: 'کلاسنو', Lattafa: 'لطافہ', Leo: 'لیو', Millac: 'ملاک', Molped: 'مولپیڈ', Nido: 'نیڈو',
  Nisa: 'نسا', Pepe: 'پیپے', Polac: 'پولاک', Polo: 'پولو', Puffin: 'پفن', RICA: 'ریکا',
  Reload: 'ری لوڈ', Sateen: 'ساٹن', Shabnam: 'شبنم', Skimillac: 'سکیمیلاک', Sprite: 'اسپرائٹ',
  Starbucks: 'اسٹاربکس', Tabasco: 'ٹباسکو', Topic: 'ٹاپک', Tyfon: 'ٹائفون', Italiano: 'اطالیانو',
  'Air Way': 'ایئر وے', 'Candy Shandy': 'کینڈی شینڈی', "Chef's Pride": 'شیفز پرائیڈ',
  'Clean Greens': 'کلین گرینز', 'Cool & Cool': 'کول اینڈ کول', 'Dr. Rashel': 'ڈاکٹر راشیل',
  'Easy Kitchen': 'ایزی کچن', 'Good Care': 'گڈ کیئر', "Nature's Own": 'نیچرز اون',
  "Nature's Bar": 'نیچرز بار', 'Nutri Lov': 'نیوٹری لوو', 'Perfect Matic': 'پرفیکٹ میٹک',
  'Power Plus': 'پاور پلس', 'Super Hockey': 'سپر ہاکی', "The Earth's": 'دی ارتھز',
  'Xtra Kleen': 'ایکسٹرا کلین', 'Soda White': 'سوڈا وائٹ', "Summer's Eve": 'سمرز ایو',
  'Tid Eaz': 'ٹڈ ایز', 'Caffe Vero': 'کیفے ویرو', 'Silky Girl': 'سلکی گرل',
  'Haut Notch': 'ہاٹ نوچ', 'Arizona Fields': 'ایریزونا فیلڈز', Quill: 'کوئل', Nice: 'نائس', Crest: 'کریسٹ',
};

/** Urdu noun + English one-liner per subcategory, plus the tile glyph. */
export const SUB_META = {
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
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
