import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Habesha Delivery database...\n');

  // Clean existing data
  await prisma.driverEarning.deleteMany();
  await prisma.driverOTP.deleteMany();
  await prisma.orderTracking.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.oTP.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.deliveryDriver.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data\n');

  // ============ CATEGORIES ============
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Grains & Cereals',
        nameAm: 'እህሎች',
        icon: '🌾',
        description: 'Teff, wheat, barley, sorghum and more',
        sortOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Spices & Seasonings',
        nameAm: 'ቅመማ ቅመም',
        icon: '🌶️',
        description: 'Berbere, mitmita, korerima and essential Ethiopian spices',
        sortOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Fruits & Vegetables',
        nameAm: 'ፍራፍሬ እና አትክልት',
        icon: '🥬',
        description: 'Fresh local produce',
        sortOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Dairy & Eggs',
        nameAm: 'የወተት ውጤቶች እና እንቁላል',
        icon: '🥛',
        description: 'Milk, cheese, yogurt, butter and eggs',
        sortOrder: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Meat & Poultry',
        nameAm: 'ስጋ',
        icon: '🥩',
        description: 'Fresh beef, lamb, goat and chicken',
        sortOrder: 5,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Beverages',
        nameAm: 'መጠጦች',
        icon: '☕',
        description: 'Coffee, tea, juices and soft drinks',
        sortOrder: 6,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Oils & Fats',
        nameAm: 'ዘይት',
        icon: '🫒',
        description: 'Cooking oils, niter kibbeh, and ghee',
        sortOrder: 7,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Legumes & Pulses',
        nameAm: 'ጥራጥሬ',
        icon: '🫘',
        description: 'Lentils, chickpeas, beans, peas',
        sortOrder: 8,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Bread & Bakery',
        nameAm: 'ዳቦ',
        icon: '🍞',
        description: 'Fresh injera, bread, and baked goods',
        sortOrder: 9,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Snacks & Sweets',
        nameAm: 'መክሰስ',
        icon: '🍪',
        description: 'Kolo, cookies, chips and treats',
        sortOrder: 10,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Household',
        nameAm: 'የቤት እቃዎች',
        icon: '🧹',
        description: 'Cleaning supplies and household essentials',
        sortOrder: 11,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Personal Care',
        nameAm: 'የግል እንክብካቤ',
        icon: '🧴',
        description: 'Soap, shampoo, toothpaste, and personal hygiene',
        sortOrder: 12,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Map categories for easy reference
  const catMap: Record<string, string> = {};
  categories.forEach(c => { catMap[c.name] = c.id; });

  // ============ PRODUCTS ============
  const productsData = [
    // Grains & Cereals
    { name: 'White Teff Flour', nameAm: 'ነጭ ጤፍ ዱቄት', price: 120, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 100, isFeatured: true, tags: ['teff', 'flour', 'injera', 'gluten-free'] },
    { name: 'Red Teff Flour', nameAm: 'ቀይ ጤፍ ዱቄት', price: 95, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 80, isFeatured: true, tags: ['teff', 'flour', 'injera'] },
    { name: 'Mixed Teff Flour', nameAm: 'ስርጉድ ጤፍ ዱቄት', price: 105, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 75, tags: ['teff', 'flour', 'injera'] },
    { name: 'Wheat Flour', nameAm: 'የስንዴ ዱቄት', price: 65, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 120, tags: ['wheat', 'flour', 'bread'] },
    { name: 'Barley (Gebs)', nameAm: 'ገብስ', price: 55, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 60, tags: ['barley', 'grain'] },
    { name: 'Sorghum', nameAm: 'ማሽላ', price: 45, unit: 'kg', unitValue: 1, categoryName: 'Grains & Cereals', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', stock: 50, tags: ['sorghum', 'grain'] },

    // Spices & Seasonings
    { name: 'Berbere Spice Mix', nameAm: 'በርበሬ', price: 180, unit: 'kg', unitValue: 0.5, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 90, isFeatured: true, tags: ['berbere', 'spice', 'hot'] },
    { name: 'Mitmita', nameAm: 'ሚጥሚጣ', price: 200, unit: 'g', unitValue: 250, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 70, isFeatured: true, tags: ['mitmita', 'spice', 'hot'] },
    { name: 'Shiro Powder', nameAm: 'ሽሮ', price: 150, unit: 'kg', unitValue: 1, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 100, isFeatured: true, tags: ['shiro', 'chickpea'] },
    { name: 'Korerima (Ethiopian Cardamom)', nameAm: 'ኮረሪማ', price: 250, unit: 'g', unitValue: 100, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 40, tags: ['korerima', 'cardamom', 'spice'] },
    { name: 'Turmeric (Ird)', nameAm: 'ዕርድ', price: 120, unit: 'g', unitValue: 250, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 55, tags: ['turmeric', 'spice'] },
    { name: 'Fenugreek (Abish)', nameAm: 'አብሽ', price: 80, unit: 'g', unitValue: 250, categoryName: 'Spices & Seasonings', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', stock: 65, tags: ['fenugreek', 'spice'] },

    // Fruits & Vegetables
    { name: 'Tomatoes', nameAm: 'ቲማቲም', price: 40, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400', stock: 200, tags: ['tomato', 'vegetable'] },
    { name: 'Onions (Red)', nameAm: 'ቀይ ሽንኩርት', price: 35, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400', stock: 180, tags: ['onion', 'vegetable'] },
    { name: 'Potatoes', nameAm: 'ድንች', price: 30, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1518977676601-b53f82ber40?w=400', stock: 150, tags: ['potato', 'vegetable'] },
    { name: 'Green Pepper', nameAm: 'ቃሪያ', price: 50, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400', stock: 100, tags: ['pepper', 'vegetable'] },
    { name: 'Garlic', nameAm: 'ነጭ ሽንኩርት', price: 120, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2571?w=400', stock: 80, tags: ['garlic', 'vegetable'] },
    { name: 'Ginger', nameAm: 'ዝንጅብል', price: 90, unit: 'kg', unitValue: 0.5, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1615485500710-aa71860d3629?w=400', stock: 60, tags: ['ginger'] },
    { name: 'Banana', nameAm: 'ሙዝ', price: 25, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', stock: 150, tags: ['banana', 'fruit'] },
    { name: 'Avocado', nameAm: 'አቦካዶ', price: 45, unit: 'piece', unitValue: 3, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400', stock: 100, isFeatured: true, tags: ['avocado', 'fruit'] },
    { name: 'Mango', nameAm: 'ማንጎ', price: 60, unit: 'kg', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400', stock: 80, tags: ['mango', 'fruit'] },
    { name: 'Papaya', nameAm: 'ፓፓያ', price: 35, unit: 'piece', unitValue: 1, categoryName: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=400', stock: 50, tags: ['papaya', 'fruit'] },

    // Dairy & Eggs
    { name: 'Fresh Milk', nameAm: 'ትኩስ ወተት', price: 45, unit: 'liter', unitValue: 1, categoryName: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', stock: 100, isPerishable: true, tags: ['milk', 'dairy'] },
    { name: 'Local Yogurt (Ergo)', nameAm: 'እርጎ', price: 55, unit: 'liter', unitValue: 1, categoryName: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', stock: 80, isPerishable: true, isFeatured: true, tags: ['yogurt', 'ergo', 'dairy'] },
    { name: 'Ayib (Ethiopian Cottage Cheese)', nameAm: 'አይብ', price: 80, unit: 'kg', unitValue: 0.5, categoryName: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400', stock: 50, isPerishable: true, tags: ['ayib', 'cheese', 'dairy'] },
    { name: 'Eggs (Dozen)', nameAm: 'እንቁላል', price: 85, unit: 'dozen', unitValue: 12, categoryName: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400', stock: 100, tags: ['eggs'] },
    { name: 'Local Butter (Kibe)', nameAm: 'ቅቤ', price: 350, unit: 'kg', unitValue: 1, categoryName: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400', stock: 40, isFeatured: true, tags: ['butter', 'kibe', 'dairy'] },

    // Meat & Poultry
    { name: 'Beef (Boneless)', nameAm: 'የበሬ ስጋ', price: 550, unit: 'kg', unitValue: 1, categoryName: 'Meat & Poultry', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400', stock: 50, isPerishable: true, tags: ['beef', 'meat'] },
    { name: 'Lamb (Yebeg Siga)', nameAm: 'የበግ ስጋ', price: 650, unit: 'kg', unitValue: 1, categoryName: 'Meat & Poultry', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400', stock: 35, isPerishable: true, tags: ['lamb', 'meat'] },
    { name: 'Goat Meat', nameAm: 'የፍየል ስጋ', price: 600, unit: 'kg', unitValue: 1, categoryName: 'Meat & Poultry', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400', stock: 30, isPerishable: true, tags: ['goat', 'meat'] },
    { name: 'Whole Chicken', nameAm: 'ዶሮ', price: 380, unit: 'piece', unitValue: 1, categoryName: 'Meat & Poultry', image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400', stock: 60, isPerishable: true, isFeatured: true, tags: ['chicken', 'poultry'] },
    { name: 'Tilapia Fish', nameAm: 'ዓሣ', price: 250, unit: 'kg', unitValue: 1, categoryName: 'Meat & Poultry', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', stock: 40, isPerishable: true, tags: ['fish', 'tilapia'] },

    // Beverages
    { name: 'Ethiopian Coffee Beans (Yirgacheffe)', nameAm: 'የይርጋጨፌ ቡና', price: 400, unit: 'kg', unitValue: 0.5, categoryName: 'Beverages', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400', stock: 80, isFeatured: true, tags: ['coffee', 'yirgacheffe'] },
    { name: 'Ethiopian Coffee Beans (Sidamo)', nameAm: 'የሲዳሞ ቡና', price: 350, unit: 'kg', unitValue: 0.5, categoryName: 'Beverages', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400', stock: 70, tags: ['coffee', 'sidamo'] },
    { name: 'Ethiopian Coffee Beans (Harar)', nameAm: 'የሐረር ቡና', price: 380, unit: 'kg', unitValue: 0.5, categoryName: 'Beverages', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400', stock: 60, tags: ['coffee', 'harar'] },
    { name: 'Black Tea', nameAm: 'ሻይ', price: 120, unit: 'pack', unitValue: 100, categoryName: 'Beverages', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', stock: 100, tags: ['tea'] },
    { name: 'Ambo Mineral Water', nameAm: 'አምቦ ውሃ', price: 25, unit: 'liter', unitValue: 1.5, categoryName: 'Beverages', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', stock: 200, tags: ['water', 'mineral'] },

    // Oils & Fats
    { name: 'Niger Seed Oil (Nug)', nameAm: 'የኑግ ዘይት', price: 280, unit: 'liter', unitValue: 1, categoryName: 'Oils & Fats', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', stock: 60, isFeatured: true, tags: ['nug', 'oil'] },
    { name: 'Sunflower Oil', nameAm: 'የሱፍ ዘይት', price: 180, unit: 'liter', unitValue: 1, categoryName: 'Oils & Fats', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', stock: 90, tags: ['sunflower', 'oil'] },
    { name: 'Niter Kibbeh (Spiced Butter)', nameAm: 'ንጥር ቅቤ', price: 450, unit: 'kg', unitValue: 0.5, categoryName: 'Oils & Fats', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400', stock: 35, isFeatured: true, tags: ['niter kibbeh', 'butter', 'spiced'] },
    { name: 'Sesame Oil', nameAm: 'የሰሊጥ ዘይት', price: 220, unit: 'liter', unitValue: 0.5, categoryName: 'Oils & Fats', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', stock: 45, tags: ['sesame', 'oil'] },

    // Legumes & Pulses
    { name: 'Red Lentils (Misir)', nameAm: 'ምስር', price: 80, unit: 'kg', unitValue: 1, categoryName: 'Legumes & Pulses', image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400', stock: 100, isFeatured: true, tags: ['lentils', 'misir'] },
    { name: 'Chickpeas (Shimbra)', nameAm: 'ሽምብራ', price: 70, unit: 'kg', unitValue: 1, categoryName: 'Legumes & Pulses', image: 'https://images.unsplash.com/photo-1515543904279-0a4e4632b3e2?w=400', stock: 85, tags: ['chickpeas'] },
    { name: 'Split Peas', nameAm: 'አተር', price: 65, unit: 'kg', unitValue: 1, categoryName: 'Legumes & Pulses', image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400', stock: 90, tags: ['peas'] },
    { name: 'White Beans', nameAm: 'ቦሎቄ', price: 75, unit: 'kg', unitValue: 1, categoryName: 'Legumes & Pulses', image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400', stock: 70, tags: ['beans'] },

    // Bread & Bakery
    { name: 'Fresh Injera (Pack of 10)', nameAm: 'እንጀራ', price: 100, unit: 'pack', unitValue: 10, categoryName: 'Bread & Bakery', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400', stock: 200, isPerishable: true, isFeatured: true, tags: ['injera', 'bread'] },
    { name: 'Ambasha Bread', nameAm: 'አምባሻ', price: 50, unit: 'piece', unitValue: 1, categoryName: 'Bread & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock: 60, isPerishable: true, tags: ['ambasha', 'bread'] },
    { name: 'Dabo (Wheat Bread)', nameAm: 'ዳቦ', price: 30, unit: 'piece', unitValue: 1, categoryName: 'Bread & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock: 80, isPerishable: true, tags: ['dabo', 'bread'] },
    { name: 'Himbasha (Celebration Bread)', nameAm: 'ህምባሻ', price: 120, unit: 'piece', unitValue: 1, categoryName: 'Bread & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock: 30, isPerishable: true, tags: ['himbasha', 'bread', 'celebration'] },

    // Snacks & Sweets
    { name: 'Kolo (Roasted Barley)', nameAm: 'ቆሎ', price: 60, unit: 'kg', unitValue: 0.5, categoryName: 'Snacks & Sweets', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400', stock: 80, isFeatured: true, tags: ['kolo', 'snack'] },
    { name: 'Pure Honey (Mar)', nameAm: 'ማር', price: 500, unit: 'kg', unitValue: 1, categoryName: 'Snacks & Sweets', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400', stock: 40, isFeatured: true, tags: ['honey', 'mar'] },
    { name: 'Dabo Kolo (Crunchy Snack)', nameAm: 'ዳቦ ቆሎ', price: 45, unit: 'g', unitValue: 250, categoryName: 'Snacks & Sweets', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400', stock: 100, tags: ['dabo kolo', 'snack'] },

    // Household
    { name: 'Laundry Detergent', nameAm: 'ሳሙና', price: 85, unit: 'kg', unitValue: 1, categoryName: 'Household', image: 'https://images.unsplash.com/photo-1585441695325-21557c1a1b8b?w=400', stock: 60, tags: ['detergent', 'clean'] },
    { name: 'Dish Soap', nameAm: 'የእቃ ማጠቢያ', price: 45, unit: 'liter', unitValue: 0.5, categoryName: 'Household', image: 'https://images.unsplash.com/photo-1585441695325-21557c1a1b8b?w=400', stock: 80, tags: ['soap', 'dish'] },
    { name: 'Toilet Paper (4 Pack)', nameAm: 'ሶፍት', price: 65, unit: 'pack', unitValue: 4, categoryName: 'Household', image: 'https://images.unsplash.com/photo-1585441695325-21557c1a1b8b?w=400', stock: 100, tags: ['toilet paper'] },

    // Personal Care
    { name: 'Body Soap', nameAm: 'የገላ ሳሙና', price: 35, unit: 'piece', unitValue: 1, categoryName: 'Personal Care', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400', stock: 120, tags: ['soap', 'body'] },
    { name: 'Shampoo', nameAm: 'ሻምፖ', price: 120, unit: 'liter', unitValue: 0.25, categoryName: 'Personal Care', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400', stock: 70, tags: ['shampoo', 'hair'] },
    { name: 'Toothpaste', nameAm: 'የጥርስ ሳሙና', price: 55, unit: 'piece', unitValue: 1, categoryName: 'Personal Care', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400', stock: 90, tags: ['toothpaste', 'dental'] },
  ];

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        nameAm: p.nameAm,
        price: p.price,
        comparePrice: p.isFeatured ? Math.round(p.price * 1.2) : undefined,
        unit: p.unit,
        unitValue: p.unitValue,
        image: p.image,
        stock: p.stock,
        isFeatured: p.isFeatured || false,
        isPerishable: p.isPerishable || false,
        tags: p.tags,
        categoryId: catMap[p.categoryName],
      },
    });
    products.push(product);
  }

  console.log(`✅ Created ${products.length} products`);

  // ============ BANNERS ============
  const banners = await Promise.all([
    prisma.banner.create({
      data: {
        title: 'Fresh Injera - Delivered in Minutes!',
        titleAm: 'ትኩስ እንጀራ - በደቂቃዎች ውስጥ!',
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
        sortOrder: 1,
      },
    }),
    prisma.banner.create({
      data: {
        title: 'Ethiopian Coffee - From Farm to Cup',
        titleAm: 'የኢትዮጵያ ቡና - ከእርሻ እስከ ስኒ',
        image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
        sortOrder: 2,
      },
    }),
    prisma.banner.create({
      data: {
        title: 'Spice Up Your Kitchen - Fresh Berbere',
        titleAm: 'ማድ ቤትዎን ያድምቁ - ትኩስ በርበሬ',
        image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800',
        sortOrder: 3,
      },
    }),
    prisma.banner.create({
      data: {
        title: '20% Off on Fresh Vegetables!',
        titleAm: 'በትኩስ አትክልት ላይ 20% ቅናሽ!',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
        sortOrder: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${banners.length} banners`);

  // ============ DELIVERY ZONES (Addis Ababa Sub-cities) ============
  const zones = await Promise.all([
    prisma.deliveryZone.create({ data: { name: 'Bole', nameAm: 'ቦሌ', subCity: 'Bole', deliveryFee: 30, minOrder: 100, estimatedMin: 10, estimatedMax: 20 } }),
    prisma.deliveryZone.create({ data: { name: 'Kirkos', nameAm: 'ቂርቆስ', subCity: 'Kirkos', deliveryFee: 35, minOrder: 100, estimatedMin: 15, estimatedMax: 25 } }),
    prisma.deliveryZone.create({ data: { name: 'Arada', nameAm: 'አራዳ', subCity: 'Arada', deliveryFee: 35, minOrder: 100, estimatedMin: 15, estimatedMax: 25 } }),
    prisma.deliveryZone.create({ data: { name: 'Yeka', nameAm: 'የካ', subCity: 'Yeka', deliveryFee: 40, minOrder: 150, estimatedMin: 15, estimatedMax: 30 } }),
    prisma.deliveryZone.create({ data: { name: 'Lideta', nameAm: 'ልደታ', subCity: 'Lideta', deliveryFee: 35, minOrder: 100, estimatedMin: 15, estimatedMax: 25 } }),
    prisma.deliveryZone.create({ data: { name: 'Addis Ketema', nameAm: 'አዲስ ከተማ', subCity: 'Addis Ketema', deliveryFee: 35, minOrder: 100, estimatedMin: 15, estimatedMax: 25 } }),
    prisma.deliveryZone.create({ data: { name: 'Gulele', nameAm: 'ጉለሌ', subCity: 'Gulele', deliveryFee: 40, minOrder: 150, estimatedMin: 15, estimatedMax: 30 } }),
    prisma.deliveryZone.create({ data: { name: 'Kolfe Keranio', nameAm: 'ኮልፌ ቀራንዮ', subCity: 'Kolfe Keranio', deliveryFee: 45, minOrder: 150, estimatedMin: 20, estimatedMax: 35 } }),
    prisma.deliveryZone.create({ data: { name: 'Nifas Silk-Lafto', nameAm: 'ንፋስ ስልክ-ላፍቶ', subCity: 'Nifas Silk-Lafto', deliveryFee: 40, minOrder: 150, estimatedMin: 15, estimatedMax: 30 } }),
    prisma.deliveryZone.create({ data: { name: 'Akaky Kaliti', nameAm: 'አቃቂ ቃሊቲ', subCity: 'Akaky Kaliti', deliveryFee: 50, minOrder: 200, estimatedMin: 25, estimatedMax: 40 } }),
    prisma.deliveryZone.create({ data: { name: 'Lemi Kura', nameAm: 'ለሚ ኩራ', subCity: 'Lemi Kura', deliveryFee: 45, minOrder: 150, estimatedMin: 20, estimatedMax: 35 } }),
  ]);

  console.log(`✅ Created ${zones.length} delivery zones`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('   Run the server with: npm run dev');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
