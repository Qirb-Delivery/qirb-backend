# Habesha Delivery — Server (Backend API)

## Project Overview

Habesha Delivery is a Blinkit-style grocery/delivery mobile app built for the **Ethiopian marketplace**. This is the **backend API server** — a Node.js/Express/TypeScript REST API with Prisma ORM on PostgreSQL, plus Socket.io for real-time order tracking.

---

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Runtime        | Node.js + TypeScript                        |
| Framework      | Express.js                                  |
| ORM            | Prisma v5.22.0                              |
| Database       | PostgreSQL 16 (Homebrew)                    |
| Real-time      | Socket.io                                   |
| Auth           | JWT (access + refresh tokens)               |
| Validation     | Zod                                         |
| Dev runner     | tsx (TypeScript execute)                     |
| Password hash  | bcryptjs                                    |

---

## File Structure

```
server/
├── .env                          # Environment variables
├── package.json
├── tsconfig.json                 # ES2020, commonjs
├── prisma/
│   ├── schema.prisma             # 14 models, 3 enums
│   └── seed.ts                   # 12 categories, 58 products, 4 banners, 11 delivery zones
└── src/
    ├── index.ts                  # Express app entry, Socket.io, mock/real route toggle
    ├── lib/
    │   └── prisma.ts             # Prisma client singleton
    ├── middleware/
    │   └── auth.ts               # JWT authenticate & optionalAuth middleware
    ├── utils/
    │   └── helpers.ts            # generateToken, generateOTP, generateOrderNumber, isValidEthiopianPhone, formatETB
    └── routes/
        ├── auth.ts               # POST send-otp, POST verify-otp, PUT profile, GET me
        ├── categories.ts         # GET /, GET /:id (with products + pagination)
        ├── products.ts           # GET / (filter/sort/paginate), GET /featured, GET /:id, POST /:id/favorite, POST /:id/review
        ├── cart.ts               # GET /, POST /add, PUT /update, DELETE /remove/:productId, DELETE /clear
        ├── orders.ts             # GET / (paginated), GET /:id, POST / (place), POST /:id/cancel
        ├── addresses.ts          # GET /, POST /, PUT /:id, DELETE /:id — auto-generates fullAddress
        ├── banners.ts            # GET / (active banners)
        ├── search.ts             # GET / (search by name/nameAm/tags), GET /popular
        └── mock.ts               # Complete in-memory mock for ALL endpoints (no DB needed)
```

---

## Environment Variables (`.env`)

```
DATABASE_URL="postgresql://amanuel.teferi@localhost:5432/habesha_delivery"
JWT_SECRET="habesha-delivery-super-secret-key-2024"
JWT_REFRESH_SECRET="habesha-delivery-refresh-secret-key-2024"
PORT=3000
NODE_ENV=development
USE_MOCK=false                    # Set true to run without PostgreSQL
OTP_EXPIRY_MINUTES=5
TELEBIRR_APP_ID=""
TELEBIRR_APP_KEY=""
TELEBIRR_SHORT_CODE=""
TELEBIRR_PUBLIC_KEY=""
CBE_BIRR_API_KEY=""
CBE_BIRR_MERCHANT_ID=""
```

---

## Mock Mode

When `USE_MOCK=true`:
- **No database required** — all data is in-memory (resets on restart)
- OTP is always **`123456`**
- Payments always succeed
- 8 categories, 12 products, 3 banners pre-loaded
- Cart, orders, addresses stored per-user in memory
- All routes served from `src/routes/mock.ts` via `app.use('/api', mockRoutes)`

When `USE_MOCK=false`:
- Real PostgreSQL required
- Individual route files are mounted at `/api/auth`, `/api/categories`, etc.

---

## API Endpoints

All endpoints are prefixed with `/api`. Auth-required endpoints expect `Authorization: Bearer <token>`.

### Health Check
| Method | Path          | Auth | Description              |
| ------ | ------------- | ---- | ------------------------ |
| GET    | `/api/health` | No   | Server status & version  |

### Authentication (`/api/auth`)
| Method | Path                   | Auth | Description                        |
| ------ | ---------------------- | ---- | ---------------------------------- |
| POST   | `/api/auth/send-otp`   | No   | Send OTP to +251 phone number      |
| POST   | `/api/auth/verify-otp` | No   | Verify OTP, returns JWT tokens      |
| GET    | `/api/auth/me`         | Yes  | Get current user profile            |
| PUT    | `/api/auth/profile`    | Yes  | Update name, email, language        |

### Categories (`/api/categories`)
| Method | Path                   | Auth | Description                                  |
| ------ | ---------------------- | ---- | -------------------------------------------- |
| GET    | `/api/categories`      | No   | List all categories                          |
| GET    | `/api/categories/:id`  | No   | Get category with products (paginated `?page=`) |

### Products (`/api/products`)
| Method | Path                          | Auth     | Description                                                     |
| ------ | ----------------------------- | -------- | --------------------------------------------------------------- |
| GET    | `/api/products`               | No       | List products (`?page=&categoryId=&featured=&sort=`)            |
| GET    | `/api/products/featured`      | No       | Featured products                                                |
| GET    | `/api/products/:id`           | Optional | Product detail (includes `isFavorite` if auth'd)                 |
| POST   | `/api/products/:id/favorite`  | Yes      | Toggle favorite                                                  |
| POST   | `/api/products/:id/review`    | Yes      | Add review `{ rating, comment? }`                                |

### Cart (`/api/cart`)
| Method | Path                             | Auth | Description                          |
| ------ | -------------------------------- | ---- | ------------------------------------ |
| GET    | `/api/cart`                      | Yes  | Get current cart                     |
| POST   | `/api/cart/add`                  | Yes  | Add item `{ productId, quantity }`   |
| PUT    | `/api/cart/update`               | Yes  | Update qty `{ productId, quantity }` |
| DELETE | `/api/cart/remove/:productId`    | Yes  | Remove item                          |
| DELETE | `/api/cart/clear`                | Yes  | Clear entire cart                    |

### Orders (`/api/orders`)
| Method | Path                        | Auth | Description                                           |
| ------ | --------------------------- | ---- | ----------------------------------------------------- |
| GET    | `/api/orders`               | Yes  | List orders (paginated `?page=&status=`)              |
| GET    | `/api/orders/:id`           | Yes  | Order detail with items, address, tracking            |
| POST   | `/api/orders`               | Yes  | Place order `{ addressId, paymentMethod, deliveryNote? }` |
| POST   | `/api/orders/:id/cancel`    | Yes  | Cancel order `{ reason? }`                            |

### Addresses (`/api/addresses`)
| Method | Path                    | Auth | Description                                      |
| ------ | ----------------------- | ---- | ------------------------------------------------ |
| GET    | `/api/addresses`        | Yes  | List user addresses                              |
| POST   | `/api/addresses`        | Yes  | Add address (server auto-generates `fullAddress`) |
| PUT    | `/api/addresses/:id`    | Yes  | Update address                                   |
| DELETE | `/api/addresses/:id`    | Yes  | Delete address                                   |

**Address fields:** `label`, `subCity`, `woreda`, `kebele`, `houseNumber`, `landmark?`, `latitude?`, `longitude?`, `isDefault?`
Server auto-builds `fullAddress` from: `${subCity}, Woreda ${woreda}, Kebele ${kebele}, House ${houseNumber}${landmark ? ', near ' + landmark : ''}`

### Banners (`/api/banners`)
| Method | Path           | Auth | Description       |
| ------ | -------------- | ---- | ----------------- |
| GET    | `/api/banners` | No   | Active banners    |

### Search (`/api/search`)
| Method | Path                  | Auth | Description                                  |
| ------ | --------------------- | ---- | -------------------------------------------- |
| GET    | `/api/search`         | No   | Search products `?q=&page=` (name/nameAm/tags) |
| GET    | `/api/search/popular` | No   | Popular search terms                          |

---

## Prisma Schema Summary

### Models (14 total)

| Model          | Key Fields                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------- |
| User           | id, phone (unique, +251), name?, email?, language (default "am"), isVerified, role               |
| OTP            | id, phone, code (6 digits), expiresAt, verified                                                 |
| Address        | id, userId, label, subCity, woreda, kebele, houseNumber?, fullAddress?, landmark?, lat/lng, isDefault |
| Category       | id, name, nameAm, description?, descriptionAm?, image, icon?, sortOrder, isActive               |
| Product        | id, categoryId, name, nameAm, description?, descriptionAm?, image, images[], price, originalPrice?, unit, stock, isActive, isFeatured, tags[], rating, reviewCount |
| CartItem       | id, userId, productId, quantity                                                                  |
| Order          | id, userId, addressId, orderNumber (HAB-XXXXXX), status, subtotal, deliveryFee, serviceFee, discount, total, paymentMethod, paymentStatus, paymentRef?, deliveryNote?, estimatedDelivery?, deliveredAt?, cancelledAt?, cancelReason? |
| OrderItem      | id, orderId, productId, name, nameAm, price, quantity, total                                     |
| OrderTracking  | id, orderId, status, message?, messageAm?, latitude?, longitude?                                 |
| Favorite       | id, userId, productId (unique per user)                                                          |
| Review         | id, userId, productId, rating (1-5), comment?                                                   |
| SearchTerm     | id, term, count                                                                                  |
| DeliveryZone   | id, name, nameAm, polygon (JSON), baseFee, perKmFee, estimatedMinutes, isActive                 |
| Banner         | id, title, titleAm?, image, link?, sortOrder, isActive, startsAt?, endsAt?                       |

### Enums (3)

| Enum           | Values                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| OrderStatus    | PENDING, CONFIRMED, PREPARING, PICKED_UP, ON_THE_WAY, DELIVERED, CANCELLED |
| PaymentMethod  | TELEBIRR, CBE_BIRR, AMOLE, CASH, BANK_TRANSFER                            |
| PaymentStatus  | PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED                           |

---

## Ethiopian Market Specifics

- **Language**: Bilingual — Amharic (`nameAm`, `descriptionAm`, `titleAm`, `messageAm`) + English
- **Currency**: ETB (Ethiopian Birr) — formatted via `formatETB()` in helpers.ts
- **Phone format**: +251XXXXXXXXX (validated by `isValidEthiopianPhone()`)
- **Payment methods**: Telebirr, CBE Birr, Amole, Cash on Delivery, Bank Transfer
- **Location**: Addis Ababa sub-cities (Bole, Kirkos, Arada, Yeka, Lideta, Kolfe Keranio, Nifas Silk-Lafto, Addis Ketema, Akaky Kaliti, Gulele, Lemi Kura)
- **Order numbers**: Format `HAB-XXXXXX` (6 random alphanumeric chars)
- **OTP in dev**: Always `123456` (hardcoded in helpers.ts when NODE_ENV !== 'production')

---

## Utility Functions (`src/utils/helpers.ts`)

| Function                 | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `generateToken(userId)`  | Create JWT access token (7d expiry)                     |
| `generateOTP()`          | Returns 6-digit OTP (always `123456` in dev)            |
| `generateOrderNumber()`  | Returns `HAB-XXXXXX` format order number                |
| `isValidEthiopianPhone(phone)` | Validates +251 phone number format                |
| `formatETB(amount)`      | Formats number as `ETB X,XXX.XX`                        |

---

## Running the Server

```bash
# Install dependencies
cd server && npm install

# Generate Prisma client
npx prisma generate

# Push schema to DB (first time)
npx prisma db push

# Seed the database
npx prisma db seed

# Start dev server
npm run dev          # runs: tsx watch src/index.ts

# Start in mock mode (no DB needed)
USE_MOCK=true npm run dev
```

---

## Socket.io Events

| Event        | Direction   | Description                          |
| ------------ | ----------- | ------------------------------------ |
| `join-order` | Client → S  | Join order room for real-time updates |
| `leave-order`| Client → S  | Leave order room                      |
| `order-update`| S → Client | Broadcast order status change (via `io.to('order-${id}')`) |

---

## Key Conventions

- All API responses follow: `{ success: boolean, message?: string, data: T }`
- Paginated responses: `{ success, data: { products/orders: T[], pagination: { page, limit, total, totalPages } } }`
- Auth middleware in `src/middleware/auth.ts` extracts user from JWT and attaches to `req.user`
- `optionalAuth` — same but doesn't reject if no token (used for product detail to check favorites)
- Error responses: `{ success: false, message: string }`
- Server runs on port `3000` by default
- CORS enabled for all origins (`*`)
- Morgan logging enabled in dev
