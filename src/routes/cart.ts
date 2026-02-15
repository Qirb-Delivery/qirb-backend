import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get cart
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    let cart = await prisma.cart.findUnique({
      where: { userId: req.userId! },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, nameAm: true, price: true,
                comparePrice: true, image: true, unit: true, unitValue: true,
                stock: true, isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: req.userId! },
        include: { items: { include: { product: true } } },
      });
    }

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      data: {
        ...cart,
        subtotal: Math.round(subtotal * 100) / 100,
        itemCount,
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/add', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }

    // Verify product exists and is active
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { userId: req.userId! } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: req.userId! } });
    }

    // Add or update cart item
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.maxOrderQty) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${product.maxOrderQty} items allowed`,
        });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    res.json({ success: true, message: 'Item added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
});

// Update cart item quantity
router.put('/update', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'Product ID and quantity required' });
    }

    const cart = await prisma.cart.findUnique({ where: { userId: req.userId! } });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    if (quantity <= 0) {
      // Remove item
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (product && quantity > product.maxOrderQty) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${product.maxOrderQty} items allowed`,
        });
      }

      await prisma.cartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity },
      });
    }

    res.json({ success: true, message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
});

// Remove item from cart
router.delete('/remove/:productId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.params;
    const cart = await prisma.cart.findUnique({ where: { userId: req.userId! } });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from cart' });
  }
});

// Clear cart
router.delete('/clear', authenticate, async (req: AuthRequest, res) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.userId! } });

    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
});

export default router;
