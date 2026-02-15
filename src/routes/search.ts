import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Search products
router.get('/', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const searchTerm = query.trim();

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameAm: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { tags: { has: searchTerm.toLowerCase() } },
            { category: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { category: { nameAm: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
        include: {
          category: { select: { id: true, name: true, nameAm: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameAm: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { tags: { has: searchTerm.toLowerCase() } },
          ],
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Get popular search terms
router.get('/popular', async (_req, res) => {
  try {
    const popularTerms = [
      { term: 'Injera', termAm: 'እንጀራ' },
      { term: 'Teff', termAm: 'ጤፍ' },
      { term: 'Berbere', termAm: 'በርበሬ' },
      { term: 'Coffee', termAm: 'ቡና' },
      { term: 'Honey', termAm: 'ማር' },
      { term: 'Milk', termAm: 'ወተት' },
      { term: 'Shiro', termAm: 'ሽሮ' },
      { term: 'Oil', termAm: 'ዘይት' },
    ];

    res.json({ success: true, data: popularTerms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch popular searches' });
  }
});

// Get discover content for search page (trending + random category products)
router.get('/discover', async (_req, res) => {
  try {
    // Get trending products (most favorited / recently popular)
    const trending = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, nameAm: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: { favorites: { _count: 'desc' } },
      take: 10,
    });

    // Pick a random category that has products
    const categoriesWithProducts = await prisma.category.findMany({
      where: {
        products: { some: { isActive: true } },
      },
      select: { id: true, name: true, nameAm: true },
    });

    let categoryProducts: any[] = [];
    let pickedCategory: { id: string; name: string; nameAm: string } | null = null;

    if (categoriesWithProducts.length > 0) {
      const randomIndex = Math.floor(Math.random() * categoriesWithProducts.length);
      pickedCategory = categoriesWithProducts[randomIndex];

      categoryProducts = await prisma.product.findMany({
        where: { isActive: true, categoryId: pickedCategory.id },
        include: {
          category: { select: { id: true, name: true, nameAm: true } },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({
      success: true,
      data: {
        trending,
        categorySection: pickedCategory
          ? { category: pickedCategory, products: categoryProducts }
          : null,
      },
    });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch discover content' });
  }
});

export default router;
