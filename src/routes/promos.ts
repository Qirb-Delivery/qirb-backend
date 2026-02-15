import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Validate & preview a promo code (does NOT consume it)
router.post('/validate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Promo code is required' });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo) {
      return res.status(404).json({ success: false, message: 'Invalid promo code / ትክክል ያልሆነ ኮድ' });
    }

    if (!promo.isActive) {
      return res.status(400).json({ success: false, message: 'This promo code is no longer active / ኮዱ ጊዜው አልፏል' });
    }

    // Check date range
    const now = new Date();
    if (promo.startDate > now) {
      return res.status(400).json({ success: false, message: 'This promo is not yet active / ይህ ማስተዋወቂያ ገና አልጀመረም' });
    }
    if (promo.endDate && promo.endDate < now) {
      return res.status(400).json({ success: false, message: 'This promo code has expired / ኮዱ ጊዜው አልፏል' });
    }

    // Check total uses
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'This promo code has been fully redeemed / ኮዱ ሙሉ በሙሉ ተጠቅሟል' });
    }

    // Check per-user limit
    const userUsageCount = await prisma.promoUsage.count({
      where: { promoCodeId: promo.id, userId: req.userId! },
    });
    if (userUsageCount >= promo.maxUsesPerUser) {
      return res.status(400).json({ success: false, message: 'You have already used this promo code / ይህን ኮድ ቀድመው ተጠቅመዋል' });
    }

    // Check minimum order
    const orderSubtotal = subtotal || 0;
    if (orderSubtotal < promo.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order of ${promo.minOrderAmount} ETB required / ዝቅተኛ ትዕዛዝ ${promo.minOrderAmount} ብር`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === 'PERCENTAGE') {
      discount = Math.round((orderSubtotal * promo.discountValue / 100) * 100) / 100;
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else {
      discount = promo.discountValue;
    }

    // Don't let discount exceed subtotal
    if (discount > orderSubtotal) {
      discount = orderSubtotal;
    }

    res.json({
      success: true,
      data: {
        id: promo.id,
        code: promo.code,
        title: promo.title,
        titleAm: promo.titleAm,
        description: promo.description,
        descriptionAm: promo.descriptionAm,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        maxDiscount: promo.maxDiscount,
        minOrderAmount: promo.minOrderAmount,
        discount, // actual calculated discount for this order
      },
    });
  } catch (error) {
    console.error('Validate promo error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate promo code' });
  }
});

// Get active promos (public listing for the user)
router.get('/active', authenticate, async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const promos = await prisma.promoCode.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        titleAm: true,
        description: true,
        descriptionAm: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderAmount: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: promos });
  } catch (error) {
    console.error('Get active promos error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch promos' });
  }
});

export default router;
