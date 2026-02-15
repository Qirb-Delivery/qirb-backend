import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const router = Router();

// ============ ADMIN AUTH MIDDLEWARE ============
// Simple admin auth: uses a shared ADMIN_SECRET env var for login,
// then issues a JWT with { role: 'admin' }.

interface AdminRequest extends Request {
  adminRole?: string;
}

const authenticateAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Admin token required' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { role: string };
    if (decoded.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Insufficient privileges' });
      return;
    }
    req.adminRole = 'admin';
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
};

// ============ LOGIN ============
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminSecret = process.env.ADMIN_SECRET || 'admin123';

  if (password !== adminSecret) {
    res.status(401).json({ success: false, message: 'Invalid admin password' });
    return;
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '24h' });
  res.json({ success: true, data: { token } });
});

// ============ DASHBOARD STATS ============
router.get('/stats', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalDrivers,
      verifiedDrivers,
      pendingDrivers,
      totalOrders,
      pendingOrders,
      activeOrders,
      deliveredOrders,
      cancelledOrders,
      totalProducts,
      totalCategories,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.deliveryDriver.count(),
      prisma.deliveryDriver.count({ where: { isVerified: true } }),
      prisma.deliveryDriver.count({ where: { isVerified: false } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({
        where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'ON_THE_WAY'] } },
      }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true } }),
    ]);

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrderCount = await prisma.order.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // Orders by day (last 7 days)
    const ordersByDay = await prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        users: { total: totalUsers },
        drivers: { total: totalDrivers, verified: verifiedDrivers, pending: pendingDrivers },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          active: activeOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
          recentWeek: recentOrderCount,
          byStatus: ordersByDay,
        },
        products: { total: totalProducts },
        categories: { total: totalCategories },
        revenue: { total: totalRevenue._sum.total || 0 },
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ============ DRIVERS ============
router.get('/drivers', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string; // verified, pending, all
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === 'verified') where.isVerified = true;
    else if (status === 'pending') where.isVerified = false;

    const [drivers, total] = await Promise.all([
      prisma.deliveryDriver.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { orders: true, earnings: true } } },
      }),
      prisma.deliveryDriver.count({ where }),
    ]);

    res.json({
      success: true,
      data: { drivers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('Admin get drivers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch drivers' });
  }
});

router.put('/drivers/:id/verify', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const driver = await prisma.deliveryDriver.update({
      where: { id: req.params.id },
      data: { isVerified: true },
    });
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify driver' });
  }
});

router.put('/drivers/:id/suspend', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const driver = await prisma.deliveryDriver.update({
      where: { id: req.params.id },
      data: { isActive: false, isOnline: false },
    });
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to suspend driver' });
  }
});

router.put('/drivers/:id/activate', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const driver = await prisma.deliveryDriver.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to activate driver' });
  }
});

// ============ ORDERS ============
router.get('/orders', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          address: { select: { subCity: true, fullAddress: true } },
          driver: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Add tracking entry
    await prisma.orderTracking.create({
      data: {
        orderId: order.id,
        status,
        message: `Order status updated to ${status} by admin`,
      },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

router.put('/orders/:id/assign-driver', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { driverId },
    });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign driver' });
  }
});

// ============ USERS ============
router.get('/users', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, phone: true, name: true, email: true,
          isVerified: true, isActive: true, createdAt: true,
          _count: { select: { orders: true, reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

router.put('/users/:id/toggle-active', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// ============ PRODUCTS ============
router.get('/products', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAm: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: { products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

router.put('/products/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { name, nameAm, price, comparePrice, stock, isActive, isFeatured, categoryId } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(price !== undefined && { price }),
        ...(comparePrice !== undefined && { comparePrice }),
        ...(stock !== undefined && { stock }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(categoryId !== undefined && { categoryId }),
      },
    });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

router.delete('/products/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

// ============ CATEGORIES ============
router.get('/categories', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

router.put('/categories/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { name, nameAm, icon, image, sortOrder, isActive } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(icon !== undefined && { icon }),
        ...(image !== undefined && { image }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
});

// ============ BANNERS ============
router.get('/banners', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const banners = await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch banners' });
  }
});

router.put('/banners/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { title, titleAm, image, link, sortOrder, isActive } = req.body;
    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(titleAm !== undefined && { titleAm }),
        ...(image !== undefined && { image }),
        ...(link !== undefined && { link }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update banner' });
  }
});

// ============ EARNINGS ============
router.get('/earnings', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const earnings = await prisma.driverEarning.findMany({
      where,
      include: { driver: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totals = await prisma.driverEarning.aggregate({
      _sum: { amount: true, tip: true, bonus: true },
    });

    res.json({ success: true, data: { earnings, totals: totals._sum } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
});

router.put('/earnings/:id/pay', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const earning = await prisma.driverEarning.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    res.json({ success: true, data: earning });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark earning as paid' });
  }
});

// ============ PROMO CODES ============

// List all promo codes
router.get('/promos', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const [promos, total] = await Promise.all([
      prisma.promoCode.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { usages: true } } },
      }),
      prisma.promoCode.count(),
    ]);
    res.json({ success: true, data: { promos, total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch promo codes' });
  }
});

// Create promo code
router.post('/promos', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const {
      code, title, titleAm, description, descriptionAm,
      discountType, discountValue, minOrderAmount,
      maxDiscount, maxUses, maxUsesPerUser,
      startDate, endDate, isActive,
    } = req.body;

    if (!code || !title || !discountType || discountValue === undefined) {
      res.status(400).json({ success: false, message: 'code, title, discountType, and discountValue are required' });
      return;
    }

    // Check for duplicate code
    const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Promo code already exists' });
      return;
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        title,
        titleAm,
        description,
        descriptionAm,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : 1,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== false,
      },
    });
    res.json({ success: true, data: promo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create promo code' });
  }
});

// Update promo code
router.put('/promos/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const {
      title, titleAm, description, descriptionAm,
      discountType, discountValue, minOrderAmount,
      maxDiscount, maxUses, maxUsesPerUser,
      startDate, endDate, isActive,
    } = req.body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (titleAm !== undefined) data.titleAm = titleAm;
    if (description !== undefined) data.description = description;
    if (descriptionAm !== undefined) data.descriptionAm = descriptionAm;
    if (discountType !== undefined) data.discountType = discountType;
    if (discountValue !== undefined) data.discountValue = parseFloat(discountValue);
    if (minOrderAmount !== undefined) data.minOrderAmount = parseFloat(minOrderAmount);
    if (maxDiscount !== undefined) data.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
    if (maxUses !== undefined) data.maxUses = maxUses ? parseInt(maxUses) : null;
    if (maxUsesPerUser !== undefined) data.maxUsesPerUser = parseInt(maxUsesPerUser);
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const promo = await prisma.promoCode.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: promo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update promo code' });
  }
});

// Toggle promo active status
router.patch('/promos/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const promo = await prisma.promoCode.findUnique({ where: { id: req.params.id } });
    if (!promo) {
      res.status(404).json({ success: false, message: 'Promo code not found' });
      return;
    }
    const updated = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: { isActive: !promo.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle promo code' });
  }
});

// Delete promo code
router.delete('/promos/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.promoCode.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Promo code deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete promo code' });
  }
});

// ============ DELIVERY ZONES ============

// List all delivery zones
router.get('/zones', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch delivery zones' });
  }
});

// Create delivery zone
router.post('/zones', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { name, nameAm, subCity, centerLat, centerLng, radiusKm, deliveryFee, minOrder, isActive, estimatedMin, estimatedMax } = req.body;

    if (!name || !subCity) {
      res.status(400).json({ success: false, message: 'name and subCity are required' });
      return;
    }

    // Check for duplicate sub-city
    const existing = await prisma.deliveryZone.findFirst({ where: { subCity } });
    if (existing) {
      res.status(400).json({ success: false, message: `Zone for "${subCity}" already exists` });
      return;
    }

    const zone = await prisma.deliveryZone.create({
      data: {
        name,
        nameAm: nameAm || null,
        subCity,
        centerLat: centerLat !== undefined && centerLat !== '' ? parseFloat(centerLat) : null,
        centerLng: centerLng !== undefined && centerLng !== '' ? parseFloat(centerLng) : null,
        radiusKm: radiusKm ? parseFloat(radiusKm) : 3.0,
        deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : 30,
        minOrder: minOrder !== undefined ? parseFloat(minOrder) : 100,
        isActive: isActive !== false,
        estimatedMin: estimatedMin ? parseInt(estimatedMin) : 15,
        estimatedMax: estimatedMax ? parseInt(estimatedMax) : 30,
      },
    });
    res.json({ success: true, data: zone });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create delivery zone' });
  }
});

// Update delivery zone
router.put('/zones/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { name, nameAm, subCity, centerLat, centerLng, radiusKm, deliveryFee, minOrder, isActive, estimatedMin, estimatedMax } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (nameAm !== undefined) data.nameAm = nameAm || null;
    if (subCity !== undefined) data.subCity = subCity;
    if (centerLat !== undefined) data.centerLat = centerLat !== '' && centerLat !== null ? parseFloat(centerLat) : null;
    if (centerLng !== undefined) data.centerLng = centerLng !== '' && centerLng !== null ? parseFloat(centerLng) : null;
    if (radiusKm !== undefined) data.radiusKm = parseFloat(radiusKm);
    if (deliveryFee !== undefined) data.deliveryFee = parseFloat(deliveryFee);
    if (minOrder !== undefined) data.minOrder = parseFloat(minOrder);
    if (isActive !== undefined) data.isActive = isActive;
    if (estimatedMin !== undefined) data.estimatedMin = parseInt(estimatedMin);
    if (estimatedMax !== undefined) data.estimatedMax = parseInt(estimatedMax);

    const zone = await prisma.deliveryZone.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: zone });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update delivery zone' });
  }
});

// Toggle zone active status
router.patch('/zones/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const zone = await prisma.deliveryZone.findUnique({ where: { id: req.params.id } });
    if (!zone) {
      res.status(404).json({ success: false, message: 'Delivery zone not found' });
      return;
    }
    const updated = await prisma.deliveryZone.update({
      where: { id: req.params.id },
      data: { isActive: !zone.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle delivery zone' });
  }
});

// Delete delivery zone
router.delete('/zones/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.deliveryZone.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Delivery zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete delivery zone' });
  }
});

export default router;
