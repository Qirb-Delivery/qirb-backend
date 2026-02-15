import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user addresses
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.userId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
});

// Build a full address string from parts
function buildFullAddress(parts: { subCity: string; woreda?: string; kebele?: string; houseNumber?: string; landmark?: string }): string {
  const segments = [parts.subCity];
  if (parts.woreda) segments.push(`Woreda ${parts.woreda}`);
  if (parts.kebele) segments.push(`Kebele ${parts.kebele}`);
  if (parts.houseNumber) segments.push(`House ${parts.houseNumber}`);
  if (parts.landmark) segments.push(`Near ${parts.landmark}`);
  return segments.join(', ');
}

// Add address
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { label, fullAddress, subCity, woreda, kebele, houseNumber, landmark, latitude, longitude, isDefault } = req.body;

    if (!label || !subCity) {
      return res.status(400).json({
        success: false,
        message: 'Label and sub-city are required',
      });
    }

    const computedFullAddress = fullAddress || buildFullAddress({ subCity, woreda, kebele, houseNumber, landmark });

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.userId! },
        data: { isDefault: false },
      });
    }

    // If first address, make it default
    const addressCount = await prisma.address.count({ where: { userId: req.userId! } });

    const address = await prisma.address.create({
      data: {
        userId: req.userId!,
        label,
        fullAddress: computedFullAddress,
        subCity,
        woreda,
        kebele,
        houseNumber,
        landmark,
        latitude,
        longitude,
        isDefault: isDefault || addressCount === 0,
      },
    });

    res.status(201).json({ success: true, data: address });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ success: false, message: 'Failed to add address' });
  }
});

// Update address
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { label, fullAddress, subCity, woreda, kebele, houseNumber, landmark, latitude, longitude, isDefault } = req.body;

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.userId!, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Recompute fullAddress if parts changed
    const updatedSubCity = subCity || existing.subCity;
    const updatedWoreda = woreda !== undefined ? woreda : existing.woreda;
    const updatedKebele = kebele !== undefined ? kebele : existing.kebele;
    const updatedHouseNumber = houseNumber !== undefined ? houseNumber : existing.houseNumber;
    const updatedLandmark = landmark !== undefined ? landmark : existing.landmark;
    const computedFullAddress = fullAddress || buildFullAddress({ subCity: updatedSubCity, woreda: updatedWoreda, kebele: updatedKebele, houseNumber: updatedHouseNumber, landmark: updatedLandmark });

    const address = await prisma.address.update({
      where: { id },
      data: {
        ...(label && { label }),
        fullAddress: computedFullAddress,
        ...(subCity && { subCity }),
        ...(woreda !== undefined && { woreda }),
        ...(kebele !== undefined && { kebele }),
        ...(houseNumber !== undefined && { houseNumber }),
        ...(landmark !== undefined && { landmark }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    res.json({ success: true, data: address });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
});

// Delete address
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.address.delete({ where: { id } });

    // If deleted was default, make another default
    if (existing.isDefault) {
      const first = await prisma.address.findFirst({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
      });
      if (first) {
        await prisma.address.update({
          where: { id: first.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

export default router;
