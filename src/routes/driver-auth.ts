import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateDriver, AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { generateOTP, isValidEthiopianPhone } from '../utils/helpers';

const router = Router();

// Send OTP to driver phone
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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Find or create driver
    let driver = await prisma.deliveryDriver.findUnique({ where: { phone } });
    if (!driver) {
      driver = await prisma.deliveryDriver.create({ data: { phone } });
    }

    // Invalidate old OTPs
    await prisma.driverOTP.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    // Create new OTP
    await prisma.driverOTP.create({
      data: {
        phone,
        code: otp,
        expiresAt,
        driverId: driver.id,
      },
    });

    console.log(`📱 Driver OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: 300,
        ...(process.env.NODE_ENV === 'development' && { otp }),
      },
    });
  } catch (error) {
    console.error('Driver send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP and login driver
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP code required',
      });
    }

    const otp = await prisma.driverOTP.findFirst({
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

    await prisma.driverOTP.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    const driver = await prisma.deliveryDriver.update({
      where: { phone },
      data: { isVerified: true },
    });

    const token = jwt.sign({ driverId: driver.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ driverId: driver.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        driver: {
          id: driver.id,
          phone: driver.phone,
          name: driver.name,
          email: driver.email,
          avatar: driver.avatar,
          language: driver.language,
          isVerified: driver.isVerified,
          isOnline: driver.isOnline,
          vehicleType: driver.vehicleType,
          vehiclePlate: driver.vehiclePlate,
          rating: driver.rating,
          totalDeliveries: driver.totalDeliveries,
          totalEarnings: driver.totalEarnings,
        },
        token,
        refreshToken,
        isNewDriver: !driver.name,
      },
    });
  } catch (error) {
    console.error('Driver verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// Update driver profile
router.put('/profile', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const { name, email, language, vehicleType, vehiclePlate, licenseNumber } = req.body;

    const driver = await prisma.deliveryDriver.update({
      where: { id: req.driverId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(language && { language }),
        ...(vehicleType && { vehicleType }),
        ...(vehiclePlate && { vehiclePlate }),
        ...(licenseNumber && { licenseNumber }),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        language: true,
        isVerified: true,
        isOnline: true,
        vehicleType: true,
        vehiclePlate: true,
        rating: true,
        totalDeliveries: true,
        totalEarnings: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: driver });
  } catch (error) {
    console.error('Update driver profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Get current driver profile
router.get('/me', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const driver = await prisma.deliveryDriver.findUnique({
      where: { id: req.driverId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        language: true,
        isVerified: true,
        isOnline: true,
        vehicleType: true,
        vehiclePlate: true,
        licenseNumber: true,
        rating: true,
        totalDeliveries: true,
        totalEarnings: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    res.json({ success: true, data: driver });
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

// Toggle online/offline status
router.post('/toggle-online', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const driver = await prisma.deliveryDriver.findUnique({ where: { id: req.driverId } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id: req.driverId },
      data: { isOnline: !driver.isOnline },
    });

    res.json({
      success: true,
      data: { isOnline: updated.isOnline },
      message: updated.isOnline ? 'You are now online' : 'You are now offline',
    });
  } catch (error) {
    console.error('Toggle online error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
});

// Update driver location
router.post('/location', authenticateDriver, async (req: AuthRequest, res) => {
  try {
    const { latitude, longitude } = req.body;

    await prisma.deliveryDriver.update({
      where: { id: req.driverId },
      data: { latitude, longitude },
    });

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
});

export default router;
