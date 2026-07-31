const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config();
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'veloura-secret-key-change-me-in-production';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Stripe — real payments. Only active when a secret key is set in .env.
// Without keys, the site falls back to the built-in mock checkout.
const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
const stripe = stripeEnabled ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Middleware
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Data
// ═══════════════════════════════════════════════════════════════════════════

let products = [
  { id: 1,  name: 'Wireless Headphones',   price: 79.99,  image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', category: 'Electronics', description: 'Premium wireless headphones with noise cancellation and 30-hour battery life.', rating: 4.5, reviews: 120 },
  { id: 2,  name: 'Leather Backpack',       price: 129.99, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', category: 'Fashion',      description: 'Handcrafted genuine leather backpack with laptop compartment.', rating: 4.8, reviews: 85 },
  { id: 3,  name: 'Smart Watch',            price: 199.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', category: 'Electronics', description: 'Feature-rich smartwatch with health tracking and GPS.', rating: 4.3, reviews: 230 },
  { id: 4,  name: 'Running Shoes',          price: 89.99,  image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', category: 'Sports',       description: 'Lightweight running shoes with superior cushioning.', rating: 4.6, reviews: 190 },
  { id: 5,  name: 'Ceramic Coffee Mug',     price: 24.99,  image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400', category: 'Home',         description: 'Handmade ceramic mug, perfect for your morning brew.', rating: 4.2, reviews: 65 },
  { id: 6,  name: 'Desk Lamp',              price: 49.99,  image: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400', category: 'Home',         description: 'Modern LED desk lamp with adjustable brightness.', rating: 4.4, reviews: 110 },
  { id: 7,  name: 'Sunglasses',             price: 159.99, image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400', category: 'Fashion',      description: 'Polarized sunglasses with UV400 protection.', rating: 4.7, reviews: 175 },
  { id: 8,  name: 'Yoga Mat',               price: 39.99,  image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400', category: 'Sports',       description: 'Non-slip yoga mat, eco-friendly material.', rating: 4.1, reviews: 95 },
  { id: 9,  name: 'Mechanical Keyboard',    price: 109.99, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', category: 'Electronics', description: 'RGB mechanical keyboard with blue switches.', rating: 4.6, reviews: 280 },
  { id: 10, name: 'Water Bottle',           price: 29.99,  image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', category: 'Sports',       description: 'Insulated stainless steel water bottle, 750ml.', rating: 4.3, reviews: 150 },
  { id: 11, name: 'Plant Pot Set',          price: 34.99,  image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400', category: 'Home',         description: 'Set of 3 minimalist ceramic plant pots.', rating: 4.5, reviews: 72 },
  { id: 12, name: 'Bluetooth Speaker',      price: 59.99,  image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400', category: 'Electronics', description: 'Portable waterproof Bluetooth speaker.', rating: 4.4, reviews: 200 },
];

let cart = [];
let nextProductId = 13;

let users = [];          // { id, name, email, passwordHash, role }
let nextUserId = 1;
let orders = [];         // { id, userId, items, total, address, payment, status, createdAt }
let nextOrderId = 1;
const pendingOrders = new Map();  // Stripe sessionId -> pending checkout { userId, address, items, total, createdAt }

// ═══════════════════════════════════════════════════════════════════════════
// Auth Helpers
// ═══════════════════════════════════════════════════════════════════════════

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware: require a valid token
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Middleware: require admin role
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    next();
  });
}

// Seed demo accounts (admin + regular user)
async function seed() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('user123', 10);
  users = [
    { id: nextUserId++, name: 'Admin', email: 'admin@veloura.com', passwordHash: adminHash, role: 'admin' },
    { id: nextUserId++, name: 'Demo User', email: 'user@demo.com', passwordHash: userHash, role: 'user' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth Routes
// ═══════════════════════════════════════════════════════════════════════════

// Register a new user account
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = { id: nextUserId++, name, email, passwordHash, role: 'user' };
  users.push(user);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// Login (works for both admin and regular users)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Get current user from token
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ═══════════════════════════════════════════════════════════════════════════
// Product Routes
// ═══════════════════════════════════════════════════════════════════════════

// Get all products (with optional category filter & search)
app.get('/api/products', (req, res) => {
  let result = [...products];
  if (req.query.category && req.query.category !== 'All') {
    result = result.filter(p => p.category === req.query.category);
  }
  if (req.query.search) {
    const s = req.query.search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)
    );
  }
  res.json(result);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Add product (admin only)
app.post('/api/products', adminRequired, (req, res) => {
  const { name, price, image, category, description } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  const product = { id: nextProductId++, name, price, image: image || '', category: category || 'General', description: description || '', rating: 0, reviews: 0 };
  products.push(product);
  res.status(201).json(product);
});

// Delete product (admin only)
app.delete('/api/products/:id', adminRequired, (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  products.splice(idx, 1);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cart Routes
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/cart', (_req, res) => {
  res.json(cart);
});

app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += quantity || 1;
  } else {
    cart.push({ productId, quantity: quantity || 1, product });
  }
  res.json(cart);
});

app.put('/api/cart/:productId', (req, res) => {
  const { quantity } = req.body;
  const item = cart.find(i => i.productId === parseInt(req.params.productId));
  if (!item) return res.status(404).json({ error: 'Item not in cart' });
  if (quantity <= 0) {
    cart = cart.filter(i => i.productId !== parseInt(req.params.productId));
  } else {
    item.quantity = quantity;
  }
  res.json(cart);
});

app.delete('/api/cart/:productId', (req, res) => {
  cart = cart.filter(i => i.productId !== parseInt(req.params.productId));
  res.json(cart);
});

app.delete('/api/cart', (_req, res) => {
  cart = [];
  res.json(cart);
});

// ═══════════════════════════════════════════════════════════════════════════
// Checkout & Orders
// ═══════════════════════════════════════════════════════════════════════════

// Build an order record from a checkout snapshot and store it
function createOrderRecord(user, items, address, paymentInfo) {
  const order = {
    id: nextOrderId++,
    userId: user.id,
    userName: user.name,
    items,
    total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    address,
    payment: paymentInfo,
    status: 'Confirmed',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}

function guessCardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  if (/^6/.test(number)) return 'Discover';
  return 'Card';
}

// Client config — frontend uses this to decide how to show the payment step
app.get('/api/config', (_req, res) => {
  res.json({
    stripeEnabled,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    mockMode: !stripeEnabled,
  });
});

// Start checkout (login required) — collects shipping address, then either
//   • creates a real Stripe Checkout session (if keys configured), or
//   • places the order directly with mock payment (fallback for local demos)
app.post('/api/checkout', authRequired, async (req, res) => {
  if (cart.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });

  const { address, payment } = req.body;
  if (!address) return res.status(400).json({ error: 'Shipping address is required.' });

  const addressFields = ['fullName', 'phone', 'street', 'city', 'state', 'zip'];
  for (const field of addressFields) {
    if (!address[field] || !String(address[field]).trim()) {
      return res.status(400).json({ error: `Please fill in ${field}.` });
    }
  }

  // Snapshot the cart so the order survives later product edits
  const items = cart.map(i => ({
    productId: i.productId,
    name: i.product.name,
    price: i.product.price,
    quantity: i.quantity,
    image: i.product.image,
    category: i.product.category,
  }));

  // ── Real Stripe payment ────────────────────────────────────────────────
  if (stripeEnabled) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: req.user.email,
        line_items: items.map(i => ({
          price_data: {
            currency: 'usd',
            product_data: { name: i.name, images: i.image ? [i.image] : [] },
            unit_amount: Math.round(i.price * 100),
          },
          quantity: i.quantity,
        })),
        metadata: { userId: String(req.user.id) },
        success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/checkout/cancel`,
      });

      pendingOrders.set(session.id, {
        userId: req.user.id,
        address,
        items,
        createdAt: new Date().toISOString(),
      });

      return res.json({ mode: 'stripe', url: session.url, sessionId: session.id });
    } catch (err) {
      return res.status(500).json({ error: 'Could not create Stripe checkout session: ' + err.message });
    }
  }

  // ── Mock payment fallback (no Stripe keys set) ─────────────────────────
  if (!payment) return res.status(400).json({ error: 'Payment details are required.' });
  const cardNumber = String(payment.cardNumber || '').replace(/\s+/g, '');
  if (!/^\d{16}$/.test(cardNumber)) {
    return res.status(400).json({ error: 'Please enter a valid 16-digit card number.' });
  }
  if (!payment.expiry || !payment.cvv) {
    return res.status(400).json({ error: 'Please complete the payment details.' });
  }

  const order = createOrderRecord(req.user, items, address, {
    method: 'mock',
    brand: guessCardBrand(cardNumber),
    last4: cardNumber.slice(-4),
    provider: 'Mock Card',
  });
  cart = [];
  res.json({ mode: 'mock', success: true, message: 'Order placed successfully!', order });
});

// Confirm a Stripe payment after the customer returns from the hosted page
app.get('/api/checkout/verify', authRequired, async (req, res) => {
  const sessionId = req.query.session_id;
  const pending = pendingOrders.get(sessionId);
  if (!pending) return res.status(404).json({ error: 'Checkout session not found.' });
  if (String(pending.userId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'This checkout belongs to another account.' });
  }
  if (!stripe) return res.status(400).json({ error: 'Stripe is not configured.' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment has not been completed.' });
    }

    const order = createOrderRecord(req.user, pending.items, pending.address, {
      method: 'stripe',
      provider: 'Stripe',
      brand: 'Stripe',
      last4: '',
      sessionId,
    });

    pendingOrders.delete(sessionId);
    // Remove the ordered items from the cart
    cart = cart.filter(c => !pending.items.some(i => i.productId === c.productId));

    res.json({ success: true, message: 'Payment successful!', order });
  } catch (err) {
    res.status(500).json({ error: 'Could not verify payment.' });
  }
});

// Get orders — users see their own, admins see all
app.get('/api/orders', authRequired, (req, res) => {
  const myOrders = req.user.role === 'admin'
    ? orders
    : orders.filter(o => o.userId === req.user.id);
  // Newest first
  res.json(myOrders.slice().reverse());
});

// ── Admin statistics (dashboard charts) ─────────────────────────────────
app.get('/api/stats', adminRequired, (_req, res) => {
  const round2 = n => Math.round(n * 100) / 100;
  const totalRevenue = round2(orders.reduce((s, o) => s + o.total, 0));
  const totalUnits = orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0);
  const totalOrders = orders.length;

  // Daily revenue & quantity for the last 14 days
  const daily = [];
  const dayMap = new Map();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const row = { date: key, label, revenue: 0, qty: 0 };
    daily.push(row);
    dayMap.set(key, row);
  }
  orders.forEach(o => {
    const day = dayMap.get(o.createdAt.slice(0, 10));
    if (day) {
      day.revenue = round2(day.revenue + o.total);
      day.qty += o.items.reduce((x, i) => x + i.quantity, 0);
    }
  });

  // Top products by quantity sold
  const prodQty = {};
  orders.forEach(o => o.items.forEach(i => {
    prodQty[i.name] = (prodQty[i.name] || 0) + i.quantity;
  }));
  const topProducts = Object.entries(prodQty)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Revenue by category
  const catRev = {};
  orders.forEach(o => o.items.forEach(i => {
    const cat = i.category || 'General';
    catRev[cat] = (catRev[cat] || 0) + i.price * i.quantity;
  }));
  const revenueByCategory = Object.entries(catRev)
    .map(([category, revenue]) => ({ category, revenue: round2(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  res.json({ totalRevenue, totalOrders, totalUnits, totalProducts: products.length, daily, topProducts, revenueByCategory });
});

// ═══════════════════════════════════════════════════════════════════════════
// Serve Frontend
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, '..', 'ecommerce-frontend')));

// Fallback: serve index.html for any non-API route (SPA-style catch-all)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'ecommerce-frontend', 'index.html'));
});

seed().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Server running at ${BASE_URL}\n`);
    console.log(`   💳  Stripe: ${stripeEnabled ? 'ENABLED (real payments)' : 'not configured — using mock checkout'}`);
    console.log('   Demo accounts:');
    console.log('   •  Admin  →  admin@veloura.com  /  admin123');
    console.log('   •  User   →  user@demo.com        /  user123\n');
  });
});
