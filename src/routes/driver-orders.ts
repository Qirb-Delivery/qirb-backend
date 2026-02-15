import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateDriver, AuthRequest } from '../middleware/auth';
import { generateDeliveryOTP } from '../utils/helpers';
import { io } from '../index';

const router = Router();

// Get available orders (CONFIRMED or READY_FOR_PICKUP, not yet assigned)
router.get('/available', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where = {
      driverId: null,
      status: { in: ['PENDING' as const, 'CONFIRMED' as const, 'READY_FOR_PICKUP' as const] },
    };

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
          user: { select: { id: true, name: true, phone: true } },
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
    console.error('Get available orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available orders' });
  }
});

// Get driver's active orders
router.get('/active', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        driverId: req.driverId!,
        status: { in: ['PICKED_UP', 'ON_THE_WAY', 'READY_FOR_PICKUP'] },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, image: true } },
          },
        },
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        tracking: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get active orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active orders' });
  }
});

// Get driver's order history
router.get('/history', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where = {
      driverId: req.driverId!,
      status: { in: ['DELIVERED' as const, 'CANCELLED' as const] },
    };

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
          user: { select: { id: true, name: true, phone: true } },
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
    console.error('Get order history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order history' });
  }
});

// Get single order details
router.get('/:id', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, image: true } },
          },
        },
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// Accept an order
router.post('/:id/accept', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        driverId: null,
        status: { in: ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'] },
      },
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order is no longer available',
      });
    }

    // Check if driver already has an active delivery
    const activeOrder = await prisma.order.findFirst({
      where: {
        driverId: req.driverId!,
        status: { in: ['PICKED_UP', 'ON_THE_WAY'] },
      },
    });

    if (activeOrder) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active delivery. Complete it first.',
      });
    }

    // Build tracking entries — if order was PENDING, also add CONFIRMED step
    const trackingEntries: any[] = [];
    if (order.status === 'PENDING') {
      trackingEntries.push({
        status: 'CONFIRMED',
        message: 'Order confirmed',
        messageAm: 'ትዕዛዝ ተረጋግጧል',
      });
    }
    trackingEntries.push({
      status: 'READY_FOR_PICKUP',
      message: 'Driver assigned and heading to pick up',
      messageAm: 'አሽከርካሪ ተመድቦ ለማንሳት በመሄድ ላይ',
    });

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        driverId: req.driverId!,
        status: 'READY_FOR_PICKUP',
        tracking: {
          create: trackingEntries,
        },
      },
      include: {
        items: true,
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify customer via socket
    io.to(`order-${order.id}`).emit('order-update', {
      orderId: order.id,
      status: 'READY_FOR_PICKUP',
      message: 'A driver has been assigned to your order',
    });

    res.json({
      success: true,
      message: 'Order accepted successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Accept order error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept order' });
  }
});

// Cancel / release an accepted order (driver gives it up)
router.post('/:id/cancel', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        driverId: req.driverId!,
        status: { in: ['READY_FOR_PICKUP', 'CONFIRMED'] }, // can only cancel before pickup
      },
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found or cannot be cancelled at this stage',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        driverId: null,
        status: 'PENDING', // Return to pending so another driver can pick it up
        tracking: {
          create: {
            status: 'PENDING',
            message: 'Driver cancelled — order available for other drivers',
            messageAm: 'አሽከርካሪ ሰርዟል — ትዕዛዝ ለሌሎች አሽከርካሪዎች ይገኛል',
          },
        },
      },
      include: {
        items: true,
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify customer
    io.to(`order-${order.id}`).emit('order-update', {
      orderId: order.id,
      status: 'PENDING',
      message: 'Looking for a new driver for your order',
    });

    res.json({
      success: true,
      message: 'Order released. It is now available for other drivers.',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

// Update order status (picked up, on the way, delivered)
router.post('/:id/status', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const { status, latitude, longitude, deliveryOTP } = req.body;

    const validTransitions: Record<string, string[]> = {
      READY_FOR_PICKUP: ['PICKED_UP'],
      PICKED_UP: ['ON_THE_WAY'],
      ON_THE_WAY: ['DELIVERED'],
    };

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, driverId: req.driverId! },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const allowedStatuses = validTransitions[order.status] || [];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`,
      });
    }

    // Require delivery OTP to mark as DELIVERED
    if (status === 'DELIVERED') {
      if (!deliveryOTP) {
        return res.status(400).json({
          success: false,
          message: 'Delivery OTP is required to complete delivery',
        });
      }
      if (order.deliveryOTP !== deliveryOTP) {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery OTP. Please ask the customer for the correct code.',
        });
      }
    }

    const statusMessages: Record<string, { en: string; am: string }> = {
      PICKED_UP: { en: 'Order picked up from store', am: 'ትዕዛዝ ከመደብር ተነስቷል' },
      ON_THE_WAY: { en: 'Driver is on the way', am: 'አሽከርካሪ በመንገድ ላይ ነው' },
      DELIVERED: { en: 'Order delivered successfully', am: 'ትዕዛዝ በተሳካ ሁኔታ ደርሷል' },
    };

    const updateData: any = {
      status,
      tracking: {
        create: {
          status,
          message: statusMessages[status]?.en,
          messageAm: statusMessages[status]?.am,
          ...(latitude && { latitude }),
          ...(longitude && { longitude }),
        },
      },
    };

    // Generate a 4-digit delivery OTP when the order is picked up
    if (status === 'PICKED_UP') {
      const otp = generateDeliveryOTP();
      updateData.deliveryOTP = otp;
    }

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();

      // Create driver earning
      const deliveryEarning = order.deliveryFee * 0.8; // Driver gets 80% of delivery fee
      await prisma.driverEarning.create({
        data: {
          driverId: req.driverId!,
          orderId: order.id,
          amount: deliveryEarning,
        },
      });

      // Update driver stats
      await prisma.deliveryDriver.update({
        where: { id: req.driverId! },
        data: {
          totalDeliveries: { increment: 1 },
          totalEarnings: { increment: deliveryEarning },
        },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        items: true,
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify customer via socket
    io.to(`order-${order.id}`).emit('order-update', {
      orderId: order.id,
      status,
      message: statusMessages[status]?.en,
    });

    // When order is picked up, also send the delivery OTP to the customer
    if (status === 'PICKED_UP') {
      io.to(`order-${order.id}`).emit('delivery-otp', {
        orderId: order.id,
        otp: updateData.deliveryOTP,
      });
    }

    res.json({
      success: true,
      message: statusMessages[status]?.en,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// Get driver earnings summary
router.get('/earnings/summary', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayEarnings, weekEarnings, monthEarnings, totalEarnings, recentEarnings] = await Promise.all([
      prisma.driverEarning.aggregate({
        where: { driverId: req.driverId!, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
        _sum: { amount: true, tip: true, bonus: true },
        _count: true,
      }),
      prisma.driverEarning.aggregate({
        where: { driverId: req.driverId!, createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
        _sum: { amount: true, tip: true, bonus: true },
        _count: true,
      }),
      prisma.driverEarning.aggregate({
        where: { driverId: req.driverId!, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        _sum: { amount: true, tip: true, bonus: true },
        _count: true,
      }),
      prisma.driverEarning.aggregate({
        where: { driverId: req.driverId!, status: { not: 'CANCELLED' } },
        _sum: { amount: true, tip: true, bonus: true },
        _count: true,
      }),
      prisma.driverEarning.findMany({
        where: { driverId: req.driverId! },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const sumAll = (agg: any) => (agg._sum.amount || 0) + (agg._sum.tip || 0) + (agg._sum.bonus || 0);

    res.json({
      success: true,
      data: {
        today: { total: sumAll(todayEarnings), deliveries: todayEarnings._count },
        thisWeek: { total: sumAll(weekEarnings), deliveries: weekEarnings._count },
        thisMonth: { total: sumAll(monthEarnings), deliveries: monthEarnings._count },
        allTime: { total: sumAll(totalEarnings), deliveries: totalEarnings._count },
        recent: recentEarnings,
      },
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
});

export default router;
