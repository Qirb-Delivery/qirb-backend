import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateToken, generateRefreshToken, generateOTP, isValidEthiopianPhone } from '../utils/helpers';

const router = Router();

// Send OTP to phone number
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Ethiopian phone number required (+251XXXXXXXXX)',
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { phone } });
    }

    // Invalidate old OTPs
    await prisma.oTP.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    // Create new OTP
    await prisma.oTP.create({
      data: {
        phone,
        code: otp,
        expiresAt,
        userId: user.id,
      },
    });

    // In production, send OTP via SMS (Ethio Telecom SMS API)
    console.log(`📱 OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: 300, // seconds
        // Only include OTP in development
        ...(process.env.NODE_ENV === 'development' && { otp }),
      },
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP and login
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP code required',
      });
    }

    const otp = await prisma.oTP.findFirst({
      where: {
        phone,
        code,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    // Get or update user
    const user = await prisma.user.update({
      where: { phone },
      data: { isVerified: true },
    });

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          language: user.language,
          isVerified: user.isVerified,
        },
        token,
        refreshToken,
        isNewUser: !user.name,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// Update profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, email, language } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(language && { language }),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        language: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        language: true,
        isVerified: true,
        createdAt: true,
        addresses: true,
        _count: {
          select: {
            orders: true,
            favorites: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

export default router;
