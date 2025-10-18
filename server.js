const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = 'secret_key_for_demo';

// --- Models ---
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
  name: String,
  desc: String,
  price: Number,
  images: [String],
  category: String
});
const Product = mongoose.model('Product', productSchema);

// --- Boosted Coupon Schema ---
const couponSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  desc: String,
  type: { type: String, enum: ['flat', 'percent'], default: 'flat' },
  amount: Number,  
  minOrder: Number,
  expiry: Date,
  enabled: { type: Boolean, default: true }
});
const Coupon = mongoose.model('Coupon', couponSchema);

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: Object,
    qty: Number
  }],
  total: Number,
  coupon: String,
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// --- Express App ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Connect to MongoDB ---
mongoose.connect(
  'mongodb+srv://abi:abi@project.3xlrbwz.mongodb.net/?retryWrites=true&w=majority&appName=project'
).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log('Mongo Error:', err));

// --- Middleware to Protect Routes ---
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ msg: 'No token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ msg: 'Wrong or expired token' });
  }
}

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.json({ msg: 'Account created', user: { name, email } });
  } catch (err) {
    res.status(400).json({ msg: 'Email already in use or bad request', err: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ msg: 'Wrong email or password' });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).json({ msg: 'Wrong email or password' });

  const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ msg: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
});

// --- PRODUCT ROUTES (CRUD) ---
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});
app.get('/api/products/:id', async (req, res) => {
  const prod = await Product.findById(req.params.id);
  prod ? res.json(prod) : res.status(404).json({ msg: 'Not found' });
});
app.post('/api/products', authMiddleware, async (req, res) => {
  const prod = await Product.create(req.body);
  res.json(prod);
});
app.put('/api/products/:id', authMiddleware, async (req, res) => {
  const prod = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(prod);
});
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Deleted' });
});

// --- COUPON ENDPOINTS ---

// GET all coupons (for frontend coupon page)
app.get('/api/coupons', async (req, res) => {
  try {
    const now = new Date();
    // Only show enabled and not expired
    const coupons = await Coupon.find({
      enabled: true,
      $or: [{ expiry: null }, { expiry: { $gte: now } }]
    });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Apply coupon (considers type, minOrder, expiry, enabled)
app.post('/api/coupons/apply', authMiddleware, async (req, res) => {
  try {
    const { code, cart } = req.body;
    if (!code || !cart) return res.status(400).json({ msg: "No code or cart sent", discount: 0 });
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), enabled: true });

    if (!coupon) return res.status(400).json({ msg: "Invalid coupon", discount: 0 });
    if (coupon.expiry && coupon.expiry < new Date()) return res.status(400).json({ msg: "Coupon expired", discount: 0 });

    let subtotal = 0;
    cart.forEach(item => {
      subtotal += item.price * item.qty;
    });

    if (coupon.minOrder && subtotal < coupon.minOrder)
      return res.status(400).json({ msg: `Min order not reached.`, discount: 0 });

    let discount = 0;
    if (coupon.type === 'flat') discount = coupon.amount;
    else if (coupon.type === 'percent') discount = Math.floor(subtotal * (coupon.amount / 100));
    discount = Math.min(discount, subtotal);

    res.json({
      code: coupon.code,
      desc: coupon.desc,
      discount,
      expiresAt: coupon.expiry,
      type: coupon.type,
      amount: coupon.amount
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Admin/demo-only: Add coupon (remove or protect after populating!)
app.post('/api/coupons/create', async (req, res) => {
  const { code, desc, type, amount, minOrder, expiry, enabled } = req.body;
  try {
    const c = await Coupon.create({ code: code.toUpperCase(), desc, type, amount, minOrder, expiry, enabled });
    res.json(c);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// --- CART & ORDER ENDPOINTS ---
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { items, total, coupon } = req.body;
  const userId = req.user.id;
  const order = await Order.create({ user: userId, items, total, coupon });
  res.json(order);
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  const orders = await Order.find({ user: req.user.id });
  res.json(orders);
});

app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  await Order.deleteOne({ _id: req.params.id, user: req.user.id });
  res.json({ msg: 'Order cancelled' });
});

// --- START SERVER ---
app.listen(5500, () => console.log('IBM Store backend running on http://localhost:5500'));
