import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import addressRoutes from './routes/addresses';
import bannerRoutes from './routes/banners';
import searchRoutes from './routes/search';
import driverAuthRoutes from './routes/driver-auth';
import driverOrderRoutes from './routes/driver-orders';
import adminRoutes from './routes/admin';
import promoRoutes from './routes/promos';
import mockRoutes from './routes/mock';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'Habesha Delivery API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes — use mock mode for testing without PostgreSQL
const useMock = process.env.USE_MOCK === 'true';
if (useMock) {
  console.log('🧪 MOCK MODE — no database required, OTP: 123456, payments always succeed');
  app.use('/api', mockRoutes);
} else {
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/banners', bannerRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/driver/auth', driverAuthRoutes);
  app.use('/api/driver/orders', driverOrderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/promos', promoRoutes);
}

// Socket.io for real-time order tracking
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Customer joins order room
  socket.on('join-order', (orderId: string) => {
    socket.join(`order-${orderId}`);
    console.log(`Client ${socket.id} joined order room: ${orderId}`);
  });

  socket.on('leave-order', (orderId: string) => {
    socket.leave(`order-${orderId}`);
  });

  // Driver joins the available orders room
  socket.on('driver-online', (driverId: string) => {
    socket.join('drivers-available');
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} is online`);
  });

  socket.on('driver-offline', (driverId: string) => {
    socket.leave('drivers-available');
    socket.leave(`driver-${driverId}`);
    console.log(`Driver ${driverId} is offline`);
  });

  // Driver location update
  socket.on('driver-location', (data: { orderId: string; latitude: number; longitude: number }) => {
    io.to(`order-${data.orderId}`).emit('driver-location-update', {
      orderId: data.orderId,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in controllers
export { io };

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Habesha Delivery API running on port ${PORT}`);
  console.log(`📡 Socket.io ready for real-time connections`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
