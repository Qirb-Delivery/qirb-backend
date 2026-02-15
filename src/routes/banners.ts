import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Get active banners
router.get('/', async (_req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banners' });
  }
});

export default router;
