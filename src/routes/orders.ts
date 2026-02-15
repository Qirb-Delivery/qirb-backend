import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateOrderNumber, findMatchingZone } from '../utils/helpers';
import { io } from '../index';

const router = Router();

// Get user orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = { userId: req.userId! };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, image: true } },
            },
          },
          address: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Check delivery zone for an address — returns fee, zone name, or rejection
router.post('/check-zone', authenticate, async (req: AuthRequest, res) => {
  try {
    const { addressId } = req.body;
    if (!addressId) {
      return res.status(400).json({ success: false, message: 'addressId required' });
    }

    const address = await prisma.address.findFirst({
      where: { id: addressId, userId: req.userId! },
    });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const allZones = await prisma.deliveryZone.findMany();
    let zone = null;

    if (address.latitude && address.longitude) {
      zone = findMatchingZone(address.latitude, address.longitude, allZones);
    }
    if (!zone) {
      zone = allZones.find((z) => z.isActive && z.subCity === address.subCity) || null;
    }

    if (!zone) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: "Sorry, we don't deliver to this area yet.",
          messageAm: 'ይቅርታ፣ ወደዚህ አካባቢ ገና አናደርስም።',
        },
      });
    }

    res.json({
      success: true,
      data: {
        available: true,
        zoneName: zone.name,
        zoneNameAm: zone.nameAm,
        deliveryFee: zone.deliveryFee,
        minOrder: zone.minOrder,
        estimatedMin: zone.estimatedMin,
        estimatedMax: zone.estimatedMax,
      },
    });
  } catch (error) {
    console.error('Check zone error:', error);
    res.status(500).json({ success: false, message: 'Failed to check delivery zone' });
  }
});

// Get order by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: {
        items: {
          include: {
            product: { select: { id: true, image: true } },
          },
        },
        address: true,
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// Place order
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { addressId, paymentMethod, deliveryNote, promoCode } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Address and payment method required',
      });
    }

    // Get cart with items
    const cart = await prisma.cart.findUnique({
      where: { userId: req.userId! },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Verify address
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId: req.userId! },
    });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Get delivery fee based on zone — geofence check first, then fallback to subCity
    const allZones = await prisma.deliveryZone.findMany();
    let zone = null;

    // 1. Try geofence matching if address has coordinates
    if (address.latitude && address.longitude) {
      zone = findMatchingZone(address.latitude, address.longitude, allZones);
    }

    // 2. Fallback to sub-city string match
    if (!zone) {
      zone = allZones.find((z) => z.isActive && z.subCity === address.subCity) || null;
    }

    // 3. Reject if no active zone covers this address
    if (!zone) {
      return res.status(400).json({
        success: false,
        message: 'Sorry, we don\'t deliver to this area yet. / ይቅርታ፣ ወደዚህ አካባቢ ገና አናደርስም።',
      });
    }

    const deliveryFee = zone.deliveryFee;
    const minOrder = zone.minOrder;

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    if (subtotal < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ${minOrder} ETB`,
      });
    }

    const serviceFee = Math.round(subtotal * 0.02 * 100) / 100; // 2% service fee

    // Apply promo code if provided
    let discount = 0;
    let appliedPromoId: string | null = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase().trim() },
      });

      if (promo && promo.isActive) {
        const now = new Date();
        const notExpired = (!promo.endDate || promo.endDate >= now) && promo.startDate <= now;
        const hasGlobalUses = promo.maxUses === null || promo.usedCount < promo.maxUses;
        const userUsageCount = await prisma.promoUsage.count({
          where: { promoCodeId: promo.id, userId: req.userId! },
        });
        const hasUserUses = userUsageCount < promo.maxUsesPerUser;

        if (notExpired && hasGlobalUses && hasUserUses && subtotal >= promo.minOrderAmount) {
          if (promo.discountType === 'PERCENTAGE') {
            discount = Math.round((subtotal * promo.discountValue / 100) * 100) / 100;
            if (promo.maxDiscount && discount > promo.maxDiscount) discount = promo.maxDiscount;
          } else {
            discount = promo.discountValue;
          }
          if (discount > subtotal) discount = subtotal;
          appliedPromoId = promo.id;
        }
      }
    }

    const total = Math.round((subtotal + deliveryFee + serviceFee - discount) * 100) / 100;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: req.userId!,
        addressId,
        subtotal,
        deliveryFee,
        serviceFee,
        discount,
        total,
        paymentMethod,
        deliveryNote,
        estimatedDelivery: new Date(Date.now() + (zone?.estimatedMax || 30) * 60 * 1000),
        items: {
          create: cart.items.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            nameAm: item.product.nameAm,
            price: item.product.price,
            quantity: item.quantity,
            total: item.product.price * item.quantity,
          })),
        },
        tracking: {
          create: {
            status: 'PENDING',
            message: 'Order placed successfully',
            messageAm: 'ትዕዛዝ በተሳካ ሁኔታ ተቀብሏል',
          },
        },
      },
      include: {
        items: true,
        address: true,
        tracking: true,
      },
    });

    // Update product stock
    for (const item of cart.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Clear cart
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Record promo usage
    if (appliedPromoId) {
      await prisma.promoUsage.create({
        data: {
          promoCodeId: appliedPromoId,
          userId: req.userId!,
          orderId: order.id,
          discount,
        },
      });
      await prisma.promoCode.update({
        where: { id: appliedPromoId },
        data: { usedCount: { increment: 1 } },
      });
    }

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

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order,
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
});

// Cancel order
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled',
      });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // Add tracking entry
    await prisma.orderTracking.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        message: `Order cancelled: ${reason || 'No reason provided'}`,
        messageAm: 'ትዕዛዙ ተሰርዟል',
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

export default router;
