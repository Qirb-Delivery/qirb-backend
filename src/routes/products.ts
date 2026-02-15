import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all products with filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const categoryId = req.query.categoryId as string;
    const featured = req.query.featured === 'true';
    const sort = req.query.sort as string || 'newest';

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (featured) where.isFeatured = true;

    let orderBy: any = { createdAt: 'desc' };
    switch (sort) {
      case 'price_low': orderBy = { price: 'asc' }; break;
      case 'price_high': orderBy = { price: 'desc' }; break;
      case 'popular': orderBy = { reviews: { _count: 'desc' } }; break;
      default: orderBy = { createdAt: 'desc' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, nameAm: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// Get featured products for home
router.get('/featured', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        category: { select: { id: true, name: true, nameAm: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured products' });
  }
});

// Get product by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, nameAm: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true, favorites: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user has favorited
    let isFavorited = false;
    if (req.userId) {
      const fav = await prisma.favorite.findUnique({
        where: { userId_productId: { userId: req.userId, productId: id } },
      });
      isFavorited = !!fav;
    }

    // Calculate average rating
    const avgRating = await prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
    });

    res.json({
      success: true,
      data: {
        ...product,
        isFavorited,
        avgRating: avgRating._avg.rating || 0,
      },
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

// Toggle favorite
router.post('/:id/favorite', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id: productId } = req.params;
    const userId = req.userId!;

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      res.json({ success: true, data: { isFavorited: false } });
    } else {
      await prisma.favorite.create({ data: { userId, productId } });
      res.json({ success: true, data: { isFavorited: true } });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle favorite' });
  }
});

// Add review
router.post('/:id/review', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id: productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId!;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
    }

    const review = await prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      update: { rating, comment },
      create: { userId, productId, rating, comment },
      include: { user: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: review });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ success: false, message: 'Failed to add review' });
  }
});

export default router;
