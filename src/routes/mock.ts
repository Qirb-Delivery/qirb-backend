/**
 * Mock routes for testing without PostgreSQL.
 * Enable by setting USE_MOCK=true in .env
 * OTP is always 123456, payment always succeeds.
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { generateOrderNumber } from '../utils/helpers';
import { io } from '../index';

const router = Router();

// ─── In-memory mock data ─────────────────────────────────────────────

const mockUsers: Record<string, any> = {};
const mockCarts: Record<string, any[]> = {};
const mockOrders: Record<string, any[]> = {};
const mockAddresses: Record<string, any[]> = {};
const mockDrivers: Record<string, any> = {};
const mockDriverEarnings: Record<string, any[]> = {};
const allMockOrders: any[] = []; // Global order list for driver access
let orderCounter = 0;

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Grains & Flour', nameAm: 'እህል እና ዱቄት', icon: '🌾', image: null, sortOrder: 1, isActive: true, parentId: null, _count: { products: 8 } },
  { id: 'cat-2', name: 'Spices', nameAm: 'ቅመማ ቅመም', icon: '🌶️', image: null, sortOrder: 2, isActive: true, parentId: null, _count: { products: 10 } },
  { id: 'cat-3', name: 'Fruits & Vegetables', nameAm: 'ፍራፍሬ እና አትክልት', icon: '🥬', image: null, sortOrder: 3, isActive: true, parentId: null, _count: { products: 12 } },
  { id: 'cat-4', name: 'Dairy & Eggs', nameAm: 'የወተት ምርቶች', icon: '🥛', image: null, sortOrder: 4, isActive: true, parentId: null, _count: { products: 6 } },
  { id: 'cat-5', name: 'Meat & Poultry', nameAm: 'ስጋ', icon: '🥩', image: null, sortOrder: 5, isActive: true, parentId: null, _count: { products: 5 } },
  { id: 'cat-6', name: 'Beverages', nameAm: 'መጠጦች', icon: '☕', image: null, sortOrder: 6, isActive: true, parentId: null, _count: { products: 8 } },
  { id: 'cat-7', name: 'Oils & Fats', nameAm: 'ዘይት', icon: '🫒', image: null, sortOrder: 7, isActive: true, parentId: null, _count: { products: 5 } },
  { id: 'cat-8', name: 'Legumes & Pulses', nameAm: 'ጥራጥሬ', icon: '🫘', image: null, sortOrder: 8, isActive: true, parentId: null, _count: { products: 7 } },
];

const MOCK_PRODUCTS = [
  { id: 'prod-1', name: 'Teff Flour (White)', nameAm: 'ነጭ ጤፍ ዱቄት', description: 'Premium white teff flour for making injera', descriptionAm: 'ለእንጀራ ማዘጋጃ የሚሆን ከፍተኛ ጥራት ያለው ነጭ ጤፍ ዱቄት', price: 120, comparePrice: 150, unit: 'kg', unitValue: 1, image: 'https://placehold.co/400x400/1B5E20/FFC107?text=Teff', images: [], stock: 50, isFeatured: true, isActive: true, categoryId: 'cat-1', tags: ['teff', 'injera', 'flour'], category: { id: 'cat-1', name: 'Grains & Flour', nameAm: 'እህል እና ዱቄት' } },
  { id: 'prod-2', name: 'Berbere Spice Mix', nameAm: 'በርበሬ', description: 'Traditional Ethiopian hot spice blend', descriptionAm: 'ባህላዊ የኢትዮጵያ ቅመም ድብልቅ', price: 85, comparePrice: null, unit: '250g', unitValue: 250, image: 'https://placehold.co/400x400/D32F2F/FFC107?text=Berbere', images: [], stock: 100, isFeatured: true, isActive: true, categoryId: 'cat-2', tags: ['berbere', 'spice'], category: { id: 'cat-2', name: 'Spices', nameAm: 'ቅመማ ቅመም' } },
  { id: 'prod-3', name: 'Shiro Powder', nameAm: 'ሽሮ', description: 'Roasted chickpea flour with spices', descriptionAm: 'የተቆላ ሽምብራ ዱቄት ከቅመም ጋር', price: 95, comparePrice: 110, unit: '500g', unitValue: 500, image: 'https://placehold.co/400x400/FFC107/1B5E20?text=Shiro', images: [], stock: 80, isFeatured: true, isActive: true, categoryId: 'cat-8', tags: ['shiro', 'chickpea'], category: { id: 'cat-8', name: 'Legumes & Pulses', nameAm: 'ጥራጥሬ' } },
  { id: 'prod-4', name: 'Ethiopian Coffee Beans', nameAm: 'የኢትዮጵያ ቡና', description: 'Premium Yirgacheffe whole bean coffee', descriptionAm: 'ከፍተኛ ጥራት ያለው የይርጋጨፌ ቡና', price: 250, comparePrice: 300, unit: '500g', unitValue: 500, image: 'https://placehold.co/400x400/3E2723/FFC107?text=Coffee', images: [], stock: 40, isFeatured: true, isActive: true, categoryId: 'cat-6', tags: ['coffee', 'yirgacheffe'], category: { id: 'cat-6', name: 'Beverages', nameAm: 'መጠጦች' } },
  { id: 'prod-5', name: 'Niter Kibbeh', nameAm: 'ንጥር ቅቤ', description: 'Ethiopian spiced clarified butter', descriptionAm: 'ባህላዊ የኢትዮጵያ ቅቤ', price: 180, comparePrice: null, unit: '500g', unitValue: 500, image: 'https://placehold.co/400x400/FFC107/3E2723?text=Kibbeh', images: [], stock: 30, isFeatured: false, isActive: true, categoryId: 'cat-7', tags: ['butter', 'kibbeh'], category: { id: 'cat-7', name: 'Oils & Fats', nameAm: 'ዘይት' } },
  { id: 'prod-6', name: 'Mitmita Spice', nameAm: 'ሚጥሚጣ', description: 'Extra hot Ethiopian chili powder', descriptionAm: 'እጅግ ጣፋጭ ሚጥሚጣ', price: 70, comparePrice: null, unit: '200g', unitValue: 200, image: 'https://placehold.co/400x400/FF5722/FFC107?text=Mitmita', images: [], stock: 60, isFeatured: false, isActive: true, categoryId: 'cat-2', tags: ['mitmita', 'chili'], category: { id: 'cat-2', name: 'Spices', nameAm: 'ቅመማ ቅመም' } },
  { id: 'prod-7', name: 'Red Lentils', nameAm: 'ምስር', description: 'Perfect for misir wot', descriptionAm: 'ለምስር ወጥ የሚሆን', price: 65, comparePrice: 80, unit: 'kg', unitValue: 1, image: 'https://placehold.co/400x400/E65100/FFC107?text=Lentils', images: [], stock: 100, isFeatured: true, isActive: true, categoryId: 'cat-8', tags: ['lentils', 'misir'], category: { id: 'cat-8', name: 'Legumes & Pulses', nameAm: 'ጥራጥሬ' } },
  { id: 'prod-8', name: 'Fresh Milk', nameAm: 'ትኩስ ወተት', description: 'Farm fresh pasteurized milk', descriptionAm: 'ትኩስ የእርሻ ወተት', price: 45, comparePrice: null, unit: 'liter', unitValue: 1, image: 'https://placehold.co/400x400/BBDEFB/1B5E20?text=Milk', images: [], stock: 25, isFeatured: false, isActive: true, categoryId: 'cat-4', tags: ['milk', 'dairy'], category: { id: 'cat-4', name: 'Dairy & Eggs', nameAm: 'የወተት ምርቶች' } },
  { id: 'prod-9', name: 'Injera (Pack of 10)', nameAm: 'እንጀራ (10 ቁጥር)', description: 'Fresh homestyle teff injera', descriptionAm: 'ትኩስ የቤት እንጀራ', price: 150, comparePrice: null, unit: 'pack', unitValue: 10, image: 'https://placehold.co/400x400/8D6E63/FFC107?text=Injera', images: [], stock: 20, isFeatured: true, isActive: true, categoryId: 'cat-1', tags: ['injera', 'bread'], category: { id: 'cat-1', name: 'Grains & Flour', nameAm: 'እህል እና ዱቄት' } },
  { id: 'prod-10', name: 'Honey (Natural)', nameAm: 'ማር', description: 'Ethiopian wildflower honey', descriptionAm: 'የኢትዮጵያ ተፈጥሮ ማር', price: 320, comparePrice: 380, unit: '500g', unitValue: 500, image: 'https://placehold.co/400x400/FF8F00/FFF?text=Honey', images: [], stock: 35, isFeatured: true, isActive: true, categoryId: 'cat-6', tags: ['honey', 'natural'], category: { id: 'cat-6', name: 'Beverages', nameAm: 'መጠጦች' } },
  { id: 'prod-11', name: 'Kocho', nameAm: 'ቆጮ', description: 'Traditional fermented enset bread', descriptionAm: 'ባህላዊ ቆጮ', price: 60, comparePrice: null, unit: 'kg', unitValue: 1, image: 'https://placehold.co/400x400/A5D6A7/1B5E20?text=Kocho', images: [], stock: 40, isFeatured: false, isActive: true, categoryId: 'cat-1', tags: ['kocho', 'enset'], category: { id: 'cat-1', name: 'Grains & Flour', nameAm: 'እህል እና ዱቄት' } },
  { id: 'prod-12', name: 'Split Peas', nameAm: 'ክክ', description: 'Yellow split peas for kik wot', descriptionAm: 'ለክክ ወጥ', price: 55, comparePrice: null, unit: 'kg', unitValue: 1, image: 'https://placehold.co/400x400/CDDC39/1B5E20?text=Peas', images: [], stock: 90, isFeatured: false, isActive: true, categoryId: 'cat-8', tags: ['peas', 'kik'], category: { id: 'cat-8', name: 'Legumes & Pulses', nameAm: 'ጥራጥሬ' } },
];

const MOCK_BANNERS = [
  { id: 'ban-1', title: 'Fresh Injera Delivered', titleAm: 'ትኩስ እንጀራ ይድርሰዎ', subtitle: 'Order now!', subtitleAm: 'አሁን ይዘዙ!', image: 'https://placehold.co/800x400/1B5E20/FFC107?text=Injera+Delivery', isActive: true, sortOrder: 1 },
  { id: 'ban-2', title: 'Spice Collection', titleAm: 'ቅመማ ቅመም ስብስብ', subtitle: '20% off all spices', subtitleAm: 'በሁሉም ቅመም 20% ቅናሽ', image: 'https://placehold.co/800x400/D32F2F/FFC107?text=Spice+Sale', isActive: true, sortOrder: 2 },
  { id: 'ban-3', title: 'Coffee Festival', titleAm: 'የቡና ፌስቲቫል', subtitle: 'Premium Ethiopian beans', subtitleAm: 'ከፍተኛ ጥራት ቡና', image: 'https://placehold.co/800x400/3E2723/FFC107?text=Coffee+Fest', isActive: true, sortOrder: 3 },
];

// ─── Auth helper ─────────────────────────────────────────────────────

function mockAuth(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch { return null; }
}

function ensureMockUser(userId: string) {
  if (!mockUsers[userId]) {
    mockUsers[userId] = { id: userId, phone: '+251912345678', name: null, email: null, avatar: null, language: 'am', isVerified: true, createdAt: new Date() };
  }
  return mockUsers[userId];
}

// ─── AUTH ────────────────────────────────────────────────────────────

router.post('/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  console.log(`📱 Mock OTP for ${phone}: 123456`);
  res.json({ success: true, message: 'OTP sent successfully', data: { phone, expiresIn: 300, otp: '123456' } });
});

router.post('/auth/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  if (code !== '123456') {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Use 123456' });
  }
  const userId = `user-${phone.replace(/\+/g, '')}`;
  const user = ensureMockUser(userId);
  user.phone = phone;

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });

  res.json({
    success: true,
    message: 'Login successful',
    data: { user, token, refreshToken, isNewUser: !user.name },
  });
});

router.put('/auth/profile', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const user = ensureMockUser(userId);
  const { name, email, language } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  if (language) user.language = language;
  res.json({ success: true, data: user });
});

router.get('/auth/me', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const user = ensureMockUser(userId);
  res.json({ success: true, data: { ...user, addresses: mockAddresses[userId] || [], _count: { orders: (mockOrders[userId] || []).length, favorites: 0 } } });
});

// ─── CATEGORIES ──────────────────────────────────────────────────────

router.get('/categories', (_req, res) => {
  res.json({ success: true, data: MOCK_CATEGORIES });
});

router.get('/categories/:id', (req, res) => {
  const cat = MOCK_CATEGORIES.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
  const products = MOCK_PRODUCTS.filter(p => p.categoryId === cat.id);
  res.json({ success: true, data: { category: cat, products, pagination: { page: 1, limit: 20, total: products.length, totalPages: 1 } } });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────

router.get('/products', (req, res) => {
  let products = [...MOCK_PRODUCTS];
  const { category, search, sort } = req.query;
  if (category) products = products.filter(p => p.categoryId === category);
  if (search) products = products.filter(p => p.name.toLowerCase().includes((search as string).toLowerCase()) || p.nameAm.includes(search as string));
  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  res.json({ success: true, data: { products, pagination: { page: 1, limit: 20, total: products.length, totalPages: 1 } } });
});

router.get('/products/featured', (_req, res) => {
  res.json({ success: true, data: MOCK_PRODUCTS.filter(p => p.isFeatured) });
});

router.get('/products/:id', (req, res) => {
  const product = MOCK_PRODUCTS.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: { ...product, reviews: [], avgRating: 4.5, reviewCount: 12, isFavorite: false } });
});

router.post('/products/:id/favorite', (req, res) => {
  res.json({ success: true, data: { isFavorite: true } });
});

router.post('/products/:id/review', (req, res) => {
  res.json({ success: true, data: { id: 'review-1', rating: req.body.rating, comment: req.body.comment } });
});

// ─── CART ────────────────────────────────────────────────────────────

router.get('/cart', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const items = mockCarts[userId] || [];
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.product.price * i.quantity), 0);
  res.json({ success: true, data: { items, subtotal, itemCount: items.length } });
});

router.post('/cart/add', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!mockCarts[userId]) mockCarts[userId] = [];

  const { productId, quantity = 1 } = req.body;
  const product = MOCK_PRODUCTS.find(p => p.id === productId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const existing = mockCarts[userId].find((i: any) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    mockCarts[userId].push({ id: `cart-${Date.now()}`, productId, quantity, product });
  }

  const items = mockCarts[userId];
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.product.price * i.quantity), 0);
  res.json({ success: true, data: { items, subtotal, itemCount: items.length } });
});

router.put('/cart/update', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { productId, quantity } = req.body;
  const items = mockCarts[userId] || [];
  const item = items.find((i: any) => i.productId === productId);
  if (item) item.quantity = quantity;
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.product.price * i.quantity), 0);
  res.json({ success: true, data: { items, subtotal, itemCount: items.length } });
});

router.delete('/cart/remove/:productId', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  mockCarts[userId] = (mockCarts[userId] || []).filter((i: any) => i.productId !== req.params.productId);
  const items = mockCarts[userId];
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.product.price * i.quantity), 0);
  res.json({ success: true, data: { items, subtotal, itemCount: items.length } });
});

router.delete('/cart/clear', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  mockCarts[userId] = [];
  res.json({ success: true, data: { items: [], subtotal: 0, itemCount: 0 } });
});

// ─── ADDRESSES ───────────────────────────────────────────────────────

router.get('/addresses', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  res.json({ success: true, data: mockAddresses[userId] || [] });
});

router.post('/addresses', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!mockAddresses[userId]) mockAddresses[userId] = [];
  const { label, subCity, woreda, kebele, houseNumber, landmark, isDefault } = req.body;
  const segments = [subCity];
  if (woreda) segments.push(`Woreda ${woreda}`);
  if (kebele) segments.push(`Kebele ${kebele}`);
  if (houseNumber) segments.push(`House ${houseNumber}`);
  if (landmark) segments.push(`Near ${landmark}`);
  const fullAddress = req.body.fullAddress || segments.join(', ');
  const addr = { id: `addr-${Date.now()}`, userId, label, fullAddress, subCity, woreda, kebele, houseNumber, landmark, isDefault: isDefault || false, createdAt: new Date(), updatedAt: new Date() };
  if (isDefault) mockAddresses[userId].forEach((a: any) => (a.isDefault = false));
  if (mockAddresses[userId].length === 0) addr.isDefault = true;
  mockAddresses[userId].push(addr);
  res.json({ success: true, data: addr });
});

router.put('/addresses/:id', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const addr = (mockAddresses[userId] || []).find((a: any) => a.id === req.params.id);
  if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
  Object.assign(addr, req.body, { updatedAt: new Date() });
  res.json({ success: true, data: addr });
});

router.delete('/addresses/:id', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  mockAddresses[userId] = (mockAddresses[userId] || []).filter((a: any) => a.id !== req.params.id);
  res.json({ success: true, message: 'Address deleted' });
});

// ─── ORDERS (mock payment always succeeds) ──────────────────────────

router.get('/orders', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const orders = mockOrders[userId] || [];
  const status = req.query.status as string;
  const filtered = status ? orders.filter((o: any) => o.status === status) : orders;
  res.json({ success: true, data: { orders: filtered, pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 } } });
});

router.get('/orders/:id', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const order = (mockOrders[userId] || []).find((o: any) => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
});

router.post('/orders', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { addressId, paymentMethod, note } = req.body;
  const cartItems = mockCarts[userId] || [];
  if (cartItems.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

  const address = (mockAddresses[userId] || []).find((a: any) => a.id === addressId);
  const subtotal = cartItems.reduce((sum: number, i: any) => sum + (i.product.price * i.quantity), 0);
  const deliveryFee = subtotal >= 500 ? 0 : 50;
  const total = subtotal + deliveryFee;

  orderCounter++;
  const order = {
    id: `order-${Date.now()}`,
    orderNumber: generateOrderNumber(),
    userId,
    status: 'PENDING',
    subtotal,
    deliveryFee,
    serviceFee: 0,
    total,
    paymentMethod,
    paymentStatus: paymentMethod === 'CASH' ? 'PENDING' : 'COMPLETED', // Mock: non-cash always succeeds
    note,
    address: address || { label: 'Default', subCity: 'Bole', woreda: '03' },
    items: cartItems.map((i: any) => ({
      id: `oi-${Date.now()}-${i.productId}`,
      productId: i.productId,
      product: i.product,
      name: i.product.name,
      nameAm: i.product.nameAm,
      price: i.product.price,
      quantity: i.quantity,
      total: i.product.price * i.quantity,
    })),
    tracking: [
      { status: 'PENDING', message: 'Order placed successfully', messageAm: 'ትዕዛዝ በተሳካ ሁኔታ ተቀብሏል', createdAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!mockOrders[userId]) mockOrders[userId] = [];
  mockOrders[userId].unshift(order);
  allMockOrders.push(order); // Also add to global list for driver access

  // Clear cart
  mockCarts[userId] = [];

  // Notify online drivers about the new order
  io.to('drivers-available').emit('new-order', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    itemCount: order.items.length,
    address: order.address ? {
      subCity: order.address.subCity,
      woreda: order.address.woreda,
    } : null,
    createdAt: order.createdAt,
  });

  console.log(`✅ Mock order placed: ${order.orderNumber} | Payment: ${paymentMethod} → ${order.paymentStatus}`);
  res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
});

router.post('/orders/:id/cancel', (req, res) => {
  const userId = mockAuth(req as AuthRequest);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const order = (mockOrders[userId] || []).find((o: any) => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  order.status = 'CANCELLED';
  order.tracking.push({ status: 'CANCELLED', message: 'Order cancelled', messageAm: 'ትዕዛዙ ተሰርዟል', createdAt: new Date() });
  res.json({ success: true, data: order });
});

// ─── BANNERS ─────────────────────────────────────────────────────────

router.get('/banners', (_req, res) => {
  res.json({ success: true, data: MOCK_BANNERS });
});

// ─── SEARCH ──────────────────────────────────────────────────────────

router.get('/search', (req, res) => {
  const q = (req.query.q as string || '').toLowerCase();
  const products = MOCK_PRODUCTS.filter(
    p => p.name.toLowerCase().includes(q) || p.nameAm.includes(q) || p.tags.some(t => t.includes(q))
  );
  res.json({ success: true, data: { products, pagination: { page: 1, limit: 20, total: products.length, totalPages: 1 } } });
});

router.get('/search/popular', (_req, res) => {
  res.json({ success: true, data: ['Teff', 'Berbere', 'Coffee', 'Shiro', 'Injera', 'Honey', 'Milk', 'Lentils'] });
});

// ─── DRIVER AUTH ─────────────────────────────────────────────────────

function mockDriverAuth(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as { driverId: string };
    return decoded.driverId;
  } catch { return null; }
}

function ensureMockDriver(driverId: string) {
  if (!mockDrivers[driverId]) {
    mockDrivers[driverId] = {
      id: driverId,
      phone: '+251912345678',
      name: null,
      email: null,
      avatar: null,
      language: 'am',
      isVerified: true,
      isOnline: false,
      vehicleType: 'MOTORCYCLE',
      vehiclePlate: null,
      licenseNumber: null,
      rating: 4.8,
      totalDeliveries: 0,
      totalEarnings: 0,
      createdAt: new Date(),
    };
  }
  return mockDrivers[driverId];
}

router.post('/driver/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  console.log(`📱 Mock Driver OTP for ${phone}: 123456`);
  res.json({ success: true, message: 'OTP sent successfully', data: { phone, expiresIn: 300, otp: '123456' } });
});

router.post('/driver/auth/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  if (code !== '123456') {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Use 123456' });
  }
  const driverId = `driver-${phone.replace(/\+/g, '')}`;
  const driver = ensureMockDriver(driverId);
  driver.phone = phone;

  const token = jwt.sign({ driverId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ driverId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });

  res.json({
    success: true,
    message: 'Login successful',
    data: { driver, token, refreshToken, isNewDriver: !driver.name },
  });
});

router.put('/driver/auth/profile', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const driver = ensureMockDriver(driverId);
  const { name, email, language, vehicleType, vehiclePlate, licenseNumber } = req.body;
  if (name) driver.name = name;
  if (email) driver.email = email;
  if (language) driver.language = language;
  if (vehicleType) driver.vehicleType = vehicleType;
  if (vehiclePlate) driver.vehiclePlate = vehiclePlate;
  if (licenseNumber) driver.licenseNumber = licenseNumber;
  res.json({ success: true, data: driver });
});

router.get('/driver/auth/me', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const driver = ensureMockDriver(driverId);
  res.json({ success: true, data: { ...driver, _count: { orders: allMockOrders.filter(o => o.driverId === driverId).length } } });
});

router.post('/driver/auth/toggle-online', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const driver = ensureMockDriver(driverId);
  driver.isOnline = !driver.isOnline;
  res.json({ success: true, data: { isOnline: driver.isOnline }, message: driver.isOnline ? 'You are now online' : 'You are now offline' });
});

router.post('/driver/auth/location', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const driver = ensureMockDriver(driverId);
  driver.latitude = req.body.latitude;
  driver.longitude = req.body.longitude;
  res.json({ success: true, message: 'Location updated' });
});

// ─── DRIVER ORDERS ───────────────────────────────────────────────────

// Seed some demo orders for drivers
function seedDriverOrders() {
  if (allMockOrders.length > 0) return;
  const statuses = ['CONFIRMED', 'CONFIRMED', 'READY_FOR_PICKUP', 'CONFIRMED'];
  const addresses = [
    { label: 'Home', subCity: 'Bole', woreda: '03', fullAddress: 'Bole, Woreda 03, Near Edna Mall' },
    { label: 'Office', subCity: 'Kirkos', woreda: '08', fullAddress: 'Kirkos, Woreda 08, Near Meskel Square' },
    { label: 'Home', subCity: 'Arada', woreda: '01', fullAddress: 'Arada, Woreda 01, Near Piassa' },
    { label: 'Home', subCity: 'Yeka', woreda: '12', fullAddress: 'Yeka, Woreda 12, Near Megenagna' },
  ];
  const customers = [
    { id: 'cust-1', name: 'Abebe Kebede', phone: '+251911223344' },
    { id: 'cust-2', name: 'Tigist Haile', phone: '+251922334455' },
    { id: 'cust-3', name: 'Dawit Mekonnen', phone: '+251933445566' },
    { id: 'cust-4', name: 'Sara Tesfaye', phone: '+251944556677' },
  ];

  for (let i = 0; i < 4; i++) {
    const items = MOCK_PRODUCTS.slice(i, i + 2).map(p => ({
      id: `oi-seed-${i}-${p.id}`,
      productId: p.id,
      product: p,
      name: p.name,
      nameAm: p.nameAm,
      price: p.price,
      quantity: Math.floor(Math.random() * 3) + 1,
      total: p.price * (Math.floor(Math.random() * 3) + 1),
    }));
    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const deliveryFee = 50;

    allMockOrders.push({
      id: `order-seed-${i}`,
      orderNumber: generateOrderNumber(),
      userId: customers[i].id,
      user: customers[i],
      driverId: null,
      status: statuses[i],
      subtotal,
      deliveryFee,
      serviceFee: 0,
      total: subtotal + deliveryFee,
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      address: addresses[i],
      items,
      tracking: [
        { status: 'PENDING', message: 'Order placed', messageAm: 'ትዕዛዝ ተቀብሏል', createdAt: new Date(Date.now() - 30 * 60000) },
        { status: statuses[i], message: 'Order confirmed', messageAm: 'ትዕዛዝ ተረጋግጧል', createdAt: new Date(Date.now() - 15 * 60000) },
      ],
      deliveryNote: i === 0 ? 'Please call when arriving' : undefined,
      estimatedDelivery: new Date(Date.now() + 30 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 60000),
      updatedAt: new Date(),
    });
  }
}

router.get('/driver/orders/available', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const available = allMockOrders.filter(o => !o.driverId && ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'].includes(o.status));
  res.json({ success: true, data: { orders: available, pagination: { page: 1, limit: 20, total: available.length, totalPages: 1 } } });
});

router.get('/driver/orders/active', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const active = allMockOrders.filter(o => o.driverId === driverId && ['READY_FOR_PICKUP', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status));
  res.json({ success: true, data: active });
});

router.get('/driver/orders/history', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const history = allMockOrders.filter(o => o.driverId === driverId && ['DELIVERED', 'CANCELLED'].includes(o.status));
  res.json({ success: true, data: { orders: history, pagination: { page: 1, limit: 20, total: history.length, totalPages: 1 } } });
});

router.get('/driver/orders/earnings/summary', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const earnings = mockDriverEarnings[driverId] || [];
  const totalAmount = earnings.reduce((sum: number, e: any) => sum + e.amount, 0);
  res.json({
    success: true,
    data: {
      today: { total: totalAmount, deliveries: earnings.length },
      thisWeek: { total: totalAmount, deliveries: earnings.length },
      thisMonth: { total: totalAmount, deliveries: earnings.length },
      allTime: { total: totalAmount, deliveries: earnings.length },
      recent: earnings.slice(0, 20),
    },
  });
});

router.get('/driver/orders/:id', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const order = allMockOrders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
});

router.post('/driver/orders/:id/accept', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const order = allMockOrders.find(o => o.id === req.params.id && !o.driverId);
  if (!order) return res.status(400).json({ success: false, message: 'Order is no longer available' });

  // Check if already has active delivery
  const active = allMockOrders.find(o => o.driverId === driverId && ['PICKED_UP', 'ON_THE_WAY'].includes(o.status));
  if (active) return res.status(400).json({ success: false, message: 'You already have an active delivery' });

  order.driverId = driverId;
  order.status = 'READY_FOR_PICKUP';
  order.tracking.push({ status: 'READY_FOR_PICKUP', message: 'Driver assigned', messageAm: 'አሽከርካሪ ተመድቧል', createdAt: new Date() });
  console.log(`🚗 Driver ${driverId} accepted order ${order.orderNumber}`);
  res.json({ success: true, message: 'Order accepted successfully', data: order });
});

router.post('/driver/orders/:id/cancel', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const order = allMockOrders.find(o => o.id === req.params.id && o.driverId === driverId && ['READY_FOR_PICKUP', 'CONFIRMED'].includes(o.status));
  if (!order) return res.status(400).json({ success: false, message: 'Order not found or cannot be cancelled' });

  order.driverId = null as any;
  order.status = 'PENDING';
  order.tracking.push({ status: 'PENDING', message: 'Driver cancelled — order available for other drivers', messageAm: 'አሽከርካሪ ሰርዟል', createdAt: new Date() });
  console.log(`❌ Driver ${driverId} cancelled order ${order.orderNumber}`);
  res.json({ success: true, message: 'Order released. It is now available for other drivers.', data: order });
});

router.post('/driver/orders/:id/status', (req, res) => {
  const driverId = mockDriverAuth(req as AuthRequest);
  if (!driverId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  seedDriverOrders();
  const order = allMockOrders.find(o => o.id === req.params.id && o.driverId === driverId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  const { status } = req.body;
  const validTransitions: Record<string, string[]> = {
    READY_FOR_PICKUP: ['PICKED_UP'],
    PICKED_UP: ['ON_THE_WAY'],
    ON_THE_WAY: ['DELIVERED'],
  };

  if (!(validTransitions[order.status] || []).includes(status)) {
    return res.status(400).json({ success: false, message: `Cannot change from ${order.status} to ${status}` });
  }

  const msgs: Record<string, { en: string; am: string }> = {
    PICKED_UP: { en: 'Order picked up from store', am: 'ትዕዛዝ ከመደብር ተነስቷል' },
    ON_THE_WAY: { en: 'Driver is on the way', am: 'አሽከርካሪ በመንገድ ላይ ነው' },
    DELIVERED: { en: 'Order delivered successfully', am: 'ትዕዛዝ በተሳካ ሁኔታ ደርሷል' },
  };

  order.status = status;
  order.tracking.push({ status, message: msgs[status]?.en, messageAm: msgs[status]?.am, createdAt: new Date() });

  if (status === 'DELIVERED') {
    order.deliveredAt = new Date();
    const earning = { id: `earn-${Date.now()}`, driverId, orderId: order.id, amount: order.deliveryFee * 0.8, tip: 0, bonus: 0, status: 'PENDING', createdAt: new Date() };
    if (!mockDriverEarnings[driverId]) mockDriverEarnings[driverId] = [];
    mockDriverEarnings[driverId].push(earning);
    const driver = ensureMockDriver(driverId);
    driver.totalDeliveries += 1;
    driver.totalEarnings += earning.amount;
  }

  console.log(`📦 Order ${order.orderNumber} → ${status}`);
  res.json({ success: true, message: msgs[status]?.en, data: order });
});

export default router;
