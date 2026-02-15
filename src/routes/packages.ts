import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/packages
 * Get all active product packages
 */
router.get('/', async (req, res) => {
  try {
    const packages = await prisma.productPackage.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

/**
 * GET /api/packages/featured
 * Get featured packages for home screen
 */
router.get('/featured', async (req, res) => {
  try {
    const packages = await prisma.productPackage.findMany({
      where: { 
        isActive: true,
        isFeatured: true,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 5,
    });

    res.json(packages);
  } catch (error) {
    console.error('Error fetching featured packages:', error);
    res.status(500).json({ error: 'Failed to fetch featured packages' });
  }
});

/**
 * GET /api/packages/:id
 * Get a single package by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const packageData = await prisma.productPackage.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(packageData);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

export default router;
