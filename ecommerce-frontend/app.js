// ═══════════════════════════════════════════════════════════════════════════
// Veloura — Luxury E-commerce Frontend Logic
// ═══════════════════════════════════════════════════════════════════════════

const API = 'http://localhost:3000/api';
let currentCategory = 'All';
let auth = null;            // { token, user }
let authMode = 'login';     // 'login' | 'register'
let afterLoginAction = null; // action to run after a successful login
let stripeEnabled = false;   // true when the server has real Stripe keys
let chartInstances = {};     // active Chart.js instances

// ═══════════════════════════════════════════════════════════════════════════
// SVG icon set — refined line icons instead of emoji
// ═══════════════════════════════════════════════════════════════════════════

function svgIcon(name) {
  const icons = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12.5H6.2L5 8z"/><path d="M9 10.5V6a3 3 0 0 1 6 0v4.5"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  };
  return icons[name] || '';
}

// Normalize Unsplash image URLs → consistent crop, quality, and size.
function imgUrl(url, w) {
  if (!url) return '';
  return url.replace(/\?.*$/, '') + `?q=80&w=${w}&auto=format&fit=crop`;
}

// Gold star rating (SVG, filled in gold)
function starRating(rating) {
  const full = Math.round(rating);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star${i <= full ? ' on' : ''}">` +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2l2.94 6.02 6.56.62-4.94 4.44 1.42 6.5L12 16.9 6 19.58l1.42-6.5-4.94-4.44 6.56-.62L12 2z"/></svg></span>';
  }
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth helpers
// ═══════════════════════════════════════════════════════════════════════════

function loadAuth() {
  const token = localStorage.getItem('veloura_token');
  const userRaw = localStorage.getItem('veloura_user');
  if (token && userRaw) {
    try { auth = { token, user: JSON.parse(userRaw) }; }
    catch (e) { auth = null; }
  } else {
    auth = null;
  }
  updateAuthUI();
}

function setAuth(token, user) {
  auth = { token, user };
  localStorage.setItem('veloura_token', token);
  localStorage.setItem('veloura_user', JSON.stringify(user));
  updateAuthUI();
}

function clearAuth() {
  auth = null;
  localStorage.removeItem('veloura_token');
  localStorage.removeItem('veloura_user');
  updateAuthUI();
}

function isLoggedIn() { return !!auth; }
function isAdmin() { return auth && auth.user.role === 'admin'; }

// fetch wrapper that adds the auth token
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (auth) headers['Authorization'] = 'Bearer ' + auth.token;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(API + path, { ...options, headers });
}

function updateAuthUI() {
  const loginBtn = document.getElementById('navLogin');
  const userChip = document.getElementById('navUser');
  const userName = document.getElementById('userName');
  const navAdmin = document.getElementById('navAdmin');
  const navOrders = document.getElementById('navOrders');

  if (auth) {
    loginBtn.style.display = 'none';
    userChip.style.display = 'flex';
    userName.textContent = auth.user.name + (isAdmin() ? ' · Atelier' : '');
    navAdmin.style.display = isAdmin() ? 'inline-flex' : 'none';
    navOrders.style.display = isAdmin() ? 'none' : 'inline-flex';
  } else {
    loginBtn.style.display = 'inline-flex';
    userChip.style.display = 'none';
    navAdmin.style.display = 'none';
    navOrders.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════════════════════

function navigateTo(page) {
  if (page === 'admin' && !isAdmin()) {
    showToast('Atelier access required');
    openAuth();
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page + 'Page').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'home') loadProducts();
  if (page === 'cart') loadCart();
  if (page === 'orders') loadOrders();
  if (page === 'checkout') renderCheckoutSummary();
  if (page === 'admin') {
    adminTab('overview');
    loadAdminDashboard();
  }
}

// Smooth-scroll the hero CTA down to the product grid
function scrollToProducts() {
  const grid = document.getElementById('productGrid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Footer "Shop" links — set the category and jump to the grid
function goShop(category) {
  currentCategory = category;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === String(category).toLowerCase());
  });
  navigateTo('home');
  loadProducts();
}

// Load whether the server is using real Stripe or mock checkout
async function loadConfig() {
  try {
    const res = await fetch(`${API}/config`);
    const config = await res.json();
    stripeEnabled = !!config.stripeEnabled;
    updateCheckoutMode();
  } catch (err) { /* keep default */ }
}

function updateCheckoutMode() {
  const mock = document.getElementById('mockPaymentSection');
  const stripeBox = document.getElementById('stripePaymentSection');
  const btn = document.getElementById('placeOrderBtn');
  const note = document.getElementById('secureNote');
  if (stripeEnabled) {
    mock.style.display = 'none';
    stripeBox.style.display = 'block';
    btn.textContent = 'Pay Securely with Stripe';
    note.textContent = 'You will be redirected to Stripe to complete payment.';
  } else {
    mock.style.display = 'block';
    stripeBox.style.display = 'none';
    btn.textContent = 'Place Order';
    note.textContent = 'Demo checkout — no real payment is processed.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast notification
// ═══════════════════════════════════════════════════════════════════════════

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth modal
// ═══════════════════════════════════════════════════════════════════════════

function openAuth(purpose) {
  afterLoginAction = purpose || null;
  authMode = 'login';
  renderAuthModal();
  document.getElementById('authModal').classList.add('open');
  setTimeout(() => document.getElementById('authEmail').focus(), 150);
}

function closeAuth(event) {
  if (!event || event.target.id === 'authModal' || event.target.classList.contains('modal-close')) {
    document.getElementById('authModal').classList.remove('open');
  }
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  renderAuthModal();
}

function renderAuthModal() {
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Welcome back' : 'Create your account';
  document.getElementById('authSubtitle').textContent =
    afterLoginAction === 'checkout' ? 'Please sign in to continue to checkout.' : 'Sign in to your Veloura account.';
  document.getElementById('nameGroup').style.display = isLogin ? 'none' : '';
  document.getElementById('authSubmit').textContent = isLogin ? 'Sign In' : 'Create Account';
  document.getElementById('authToggleText').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('authToggleBtn').textContent = isLogin ? 'Create one' : 'Sign in';
  document.getElementById('authForm').reset();
}

async function handleAuth(event) {
  event.preventDefault();
  const isLogin = authMode === 'login';
  const body = isLogin
    ? { email: document.getElementById('authEmail').value.trim(), password: document.getElementById('authPassword').value }
    : {
        name: document.getElementById('authName').value.trim(),
        email: document.getElementById('authEmail').value.trim(),
        password: document.getElementById('authPassword').value,
      };

  if (!isLogin && !body.name) return showToast('Please enter your name');

  try {
    const res = await fetch(`${API}/auth/${isLogin ? 'login' : 'register'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Authentication failed');

    setAuth(data.token, data.user);
    closeAuth();
    showToast(`Welcome, ${data.user.name}.`);

    if (afterLoginAction === 'checkout') startCheckout();
  } catch (err) {
    showToast('Could not reach the server');
  }
}

function logout() {
  clearAuth();
  showToast('You have been signed out.');
  navigateTo('home');
}

// ═══════════════════════════════════════════════════════════════════════════
// Products
// ═══════════════════════════════════════════════════════════════════════════

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<div class="empty-state"><p>Loading the collection...</p></div>';

  try {
    let url = `${API}/products`;
    const params = new URLSearchParams();
    if (currentCategory !== 'All') params.set('category', currentCategory);
    if (document.getElementById('searchInput').value.trim()) {
      params.set('search', document.getElementById('searchInput').value.trim());
    }
    const qs = params.toString();
    if (qs) url += '?' + qs;

    const res = await fetch(url);
    const products = await res.json();

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${svgIcon('box')}</div>
          <h3 class="empty-title">No pieces found</h3>
          <p class="empty-sub">Try a different category or search term.</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map((p, i) => `
      <div class="product-card reveal" style="--reveal-delay:${(i % 12) * 50}ms" onclick="viewProduct(${p.id})">
        <div class="product-img-wrap">
          <img src="${imgUrl(p.image, 800)}" alt="${p.name}" loading="lazy"
               onerror="this.src='data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#111111" width="200" height="200"/><text x="50%" y="50%" fill="#8a8a8a" font-family="sans-serif" font-size="18" letter-spacing="3" text-anchor="middle" dy=".3em">VELOURA</text></svg>')}'">
          <span class="product-category-chip">${p.category}</span>
          <button class="product-quick" onclick="addToCart(${p.id}, event)">Add to Cart</button>
        </div>
        <div class="product-body">
          <span class="product-name">${p.name}</span>
          <span class="product-rating">${starRating(p.rating)}<span class="rating-count">${p.reviews} reviews</span></span>
        </div>
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="add-cart-btn" onclick="addToCart(${p.id}, event)">Add to Cart</button>
        </div>
      </div>
    `).join('');
    observeReveals(grid);
  } catch (err) {
    grid.innerHTML = '<div class="empty-state"><h3 class="empty-title">Something went wrong</h3><p class="empty-sub">Could not load the collection. Is the server running?</p></div>';
  }
}

function filterCategory(category) {
  currentCategory = category;
  const clicked = event && event.target.classList && event.target.classList.contains('filter-btn')
    ? event.target
    : [...document.querySelectorAll('.filter-btn')]
        .find(b => b.textContent.trim().toLowerCase() === String(category).toLowerCase());
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (clicked) clicked.classList.add('active');
  loadProducts();
}

function searchProducts(term) {
  clearTimeout(searchProducts._timer);
  searchProducts._timer = setTimeout(loadProducts, 300);
}

// ═══════════════════════════════════════════════════════════════════════════
// Product detail
// ═══════════════════════════════════════════════════════════════════════════

async function viewProduct(id) {
  try {
    const res = await fetch(`${API}/products/${id}`);
    const p = await res.json();

    document.getElementById('productDetail').innerHTML = `
      <button class="back-btn" onclick="navigateTo('home')">Back to Products</button>
      <div class="detail-img"><img src="${imgUrl(p.image, 1000)}" alt="${p.name}"
           onerror="this.src='data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="#111111" width="400" height="400"/><text x="50%" y="50%" fill="#8a8a8a" font-family="sans-serif" font-size="30" letter-spacing="4" text-anchor="middle" dy=".3em">VELOURA</text></svg>')}'"></div>
      <div class="detail-info">
        <h2>${p.name}</h2>
        <div class="detail-category">${p.category}</div>
        <div class="detail-rating">${starRating(p.rating)}<span>${p.rating} — ${p.reviews} reviews</span></div>
        <div class="detail-price">$${p.price.toFixed(2)}</div>
        <p class="detail-desc">${p.description}</p>
        <div class="detail-divider"></div>
        <div class="qty-row">
          <label for="detailQty">Quantity</label>
          <input type="number" id="detailQty" value="1" min="1" max="99">
        </div>
        <button class="btn-primary" onclick="addToCart(${p.id})">Add to Cart</button>
      </div>
    `;

    navigateTo('detail');
  } catch (err) {
    showToast('Could not load product details');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cart
// ═══════════════════════════════════════════════════════════════════════════

async function addToCart(productId, event) {
  if (event) event.stopPropagation();
  const qtyEl = document.getElementById('detailQty');
  const quantity = qtyEl ? parseInt(qtyEl.value) || 1 : 1;

  try {
    await apiFetch(`/cart`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    updateCartCount();
    showToast('Added to your selection');
  } catch (err) {
    showToast('Could not add to cart');
  }
}

async function updateCartCount() {
  try {
    const res = await fetch(`${API}/cart`);
    const cart = await res.json();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
  } catch (err) { /* ignore */ }
}

async function loadCart() {
  try {
    const res = await fetch(`${API}/cart`);
    const cart = await res.json();

    const container = document.getElementById('cartItems');
    const summary = document.getElementById('cartSummary');
    const empty = document.getElementById('emptyCart');

    if (cart.length === 0) {
      container.innerHTML = '';
      summary.style.display = 'none';
      empty.style.display = 'block';
      renderSuggestions(document.getElementById('emptyCartSuggestions'));
      return;
    }

    empty.style.display = 'none';
    summary.style.display = 'flex';
    let total = 0;

    container.innerHTML = cart.map(item => {
      const subtotal = item.product.price * item.quantity;
      total += subtotal;
      return `
        <div class="cart-item">
          <img class="cart-item-img" src="${imgUrl(item.product.image, 300)}" alt="${item.product.name}">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.product.name}</div>
            <div class="cart-item-price">$${item.product.price.toFixed(2)} each</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="changeQty(${item.productId}, ${item.quantity - 1})">−</button>
            <span class="cart-item-qty">${item.quantity}</span>
            <button class="qty-btn" onclick="changeQty(${item.productId}, ${item.quantity + 1})">+</button>
          </div>
          <span class="cart-item-subtotal">$${subtotal.toFixed(2)}</span>
          <button class="remove-btn" onclick="removeFromCart(${item.productId})">${svgIcon('trash')}</button>
        </div>
      `;
    }).join('');

    document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
  } catch (err) {
    showToast('Could not load cart');
  }
}

async function changeQty(productId, quantity) {
  try {
    await apiFetch(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
    updateCartCount();
    loadCart();
  } catch (err) { showToast('Could not update quantity'); }
}

async function removeFromCart(productId) {
  try {
    await apiFetch(`/cart/${productId}`, { method: 'DELETE' });
    updateCartCount();
    loadCart();
    showToast('Removed from your selection');
  } catch (err) { showToast('Could not remove item'); }
}

async function clearCart() {
  try {
    await apiFetch(`/cart`, { method: 'DELETE' });
    updateCartCount();
    loadCart();
  } catch (err) { showToast('Could not clear cart'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Checkout
// ═══════════════════════════════════════════════════════════════════════════

async function checkout() {
  if (!isLoggedIn()) {
    showToast('Please sign in to continue');
    openAuth('checkout');
    return;
  }
  startCheckout();
}

function startCheckout() {
  // Reset success state in case of a previous order
  document.getElementById('checkoutForm').style.display = '';
  document.getElementById('checkoutSummaryBox').style.display = '';
  document.getElementById('orderSuccess').style.display = 'none';
  navigateTo('checkout');
}

async function renderCheckoutSummary() {
  try {
    const res = await fetch(`${API}/cart`);
    const cart = await res.json();

    if (cart.length === 0) {
      showToast('Your selection is empty');
      navigateTo('cart');
      return;
    }

    let total = 0;
    document.getElementById('checkoutItems').innerHTML = cart.map(item => {
      const subtotal = item.product.price * item.quantity;
      total += subtotal;
      return `
        <div class="checkout-item">
          <img src="${imgUrl(item.product.image, 200)}" alt="${item.product.name}">
          <div class="checkout-item-info">
            <div class="checkout-item-name">${item.product.name}</div>
            <div class="checkout-item-meta">${item.quantity} × $${item.product.price.toFixed(2)}</div>
          </div>
          <span class="checkout-item-sub">$${subtotal.toFixed(2)}</span>
        </div>
      `;
    }).join('');

    document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;
  } catch (err) {
    showToast('Could not load checkout summary');
  }
}

async function placeOrder(event) {
  event.preventDefault();

  const address = {
    fullName: document.getElementById('addrName').value.trim(),
    phone: document.getElementById('addrPhone').value.trim(),
    street: document.getElementById('addrStreet').value.trim(),
    city: document.getElementById('addrCity').value.trim(),
    state: document.getElementById('addrState').value.trim(),
    zip: document.getElementById('addrZip').value.trim(),
  };

  // Build payment payload (mock mode only — Stripe never sees card data here)
  let payment = { method: 'mock' };
  if (!stripeEnabled) {
    const cardNumber = document.getElementById('payNumber').value.replace(/\s+/g, '');
    payment = {
      method: 'mock',
      cardNumber,
      expiry: document.getElementById('payExpiry').value.trim(),
      cvv: document.getElementById('payCvv').value.trim(),
    };
    if (!/^\d{16}$/.test(cardNumber)) return showToast('Please enter a valid 16-digit card number');
    if (!/^\d{2}\/\d{2}$/.test(payment.expiry)) return showToast('Enter expiry as MM/YY');
    if (!/^\d{3,4}$/.test(payment.cvv)) return showToast('Enter a valid CVV');
  }

  const submitBtn = document.querySelector('.checkout-submit');
  const normalLabel = stripeEnabled ? 'Pay Securely with Stripe' : 'Place Order';
  submitBtn.disabled = true;
  submitBtn.textContent = stripeEnabled ? 'Redirecting to Stripe...' : 'Processing...';

  try {
    const res = await apiFetch('/checkout', {
      method: 'POST',
      body: JSON.stringify({ address, payment }),
    });
    const data = await res.json();

    if (!res.ok) {
      submitBtn.disabled = false;
      submitBtn.textContent = normalLabel;
      return showToast(data.error || 'Could not place order');
    }

    if (data.mode === 'stripe') {
      window.location.href = data.url;  // redirect to Stripe hosted checkout
      return;
    }

    updateCartCount();
    renderOrderSuccess(data.order);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = normalLabel;
    showToast('Could not place order');
  }
}

// Called when the customer returns from Stripe: confirm the payment and show the order
async function verifyCheckout(sessionId) {
  if (!isLoggedIn()) {
    openAuth();
    return;
  }
  try {
    const res = await apiFetch(`/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not confirm payment');
      navigateTo('cart');
      return;
    }
    updateCartCount();
    renderOrderSuccess(data.order);
  } catch (err) {
    showToast('Could not confirm payment');
    navigateTo('cart');
  }
}

// Handle the /checkout/cancel return from Stripe
function handleCheckoutCancel() {
  if (window.location.pathname.includes('checkout/cancel')) {
    showToast('Payment was cancelled. Your selection is still here.');
    history.replaceState({}, '', '/');
    navigateTo('cart');
    return true;
  }
  return false;
}

function renderOrderSuccess(order) {
  document.getElementById('checkoutForm').style.display = 'none';
  document.getElementById('checkoutSummaryBox').style.display = 'none';
  document.getElementById('orderSuccess').style.display = 'block';

  document.getElementById('orderSuccess').innerHTML = `
    <div class="success-icon">${svgIcon('check')}</div>
    <h2>Order Confirmed</h2>
    <p class="success-order">Order No. ${order.id}</p>
    <p class="success-total">Total charged: <strong>$${order.total.toFixed(2)}</strong></p>
    <p class="success-meta">${paymentLabel(order.payment)}</p>
    <p class="success-meta">Delivering to ${order.address.fullName}, ${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zip}</p>
    <div class="success-actions">
      <button class="btn-primary" onclick="navigateTo('orders')">View My Orders</button>
      <button class="btn-secondary" onclick="navigateTo('home')">Continue Shopping</button>
    </div>
  `;
}

function paymentLabel(payment) {
  if (payment && payment.method === 'stripe') return 'Paid securely via Stripe';
  if (payment && payment.last4) return `Paid with ${payment.brand} ···· ${payment.last4}`;
  return 'Paid';
}

// Input formatters
function formatCardNumber(input) {
  const v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
  input.value = v;
}

// ═══════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════

function orderCardHTML(o) {
  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-id">Order No. ${o.id}</span>
          <span class="order-status">${o.status}</span>
        </div>
        <div class="order-date">${formatDate(o.createdAt)}</div>
      </div>
      <div class="order-items">
        ${o.items.map(i => `
          <div class="order-item">
            <img src="${imgUrl(i.image, 200)}" alt="${i.name}">
            <span class="order-item-name">${i.name}</span>
            <span class="order-item-qty">× ${i.quantity}</span>
            <span class="order-item-price">$${(i.price * i.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-footer">
        <span class="order-ship-to">Delivering to ${o.address.city}, ${o.address.state} · ${paymentLabel(o.payment)}</span>
        <span class="order-total">$${o.total.toFixed(2)}</span>
      </div>
    </div>
  `;
}

async function loadOrders() {
  const list = document.getElementById('ordersList');

  if (!isLoggedIn()) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${svgIcon('lock')}</div>
        <h3 class="empty-title">Sign in to view your orders</h3>
        <p class="empty-sub">Track deliveries and revisit past purchases anytime.</p>
        <button class="btn-primary" onclick="openAuth()">Sign In</button>
        <div id="ordersSuggestions"></div>
      </div>
    `;
    renderSuggestions(document.getElementById('ordersSuggestions'));
    return;
  }

  list.innerHTML = '<div class="empty-state"><p>Loading your orders...</p></div>';

  try {
    const res = await apiFetch('/orders');
    if (!res.ok) {
      list.innerHTML = '<div class="empty-state"><p>Could not load your orders.</p></div>';
      return;
    }
    const orders = await res.json();

    if (orders.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${svgIcon('box')}</div>
          <h3 class="empty-title">No orders yet</h3>
          <p class="empty-sub">When you place your first order, it will appear here.</p>
          <div id="ordersSuggestions"></div>
        </div>
      `;
      renderSuggestions(document.getElementById('ordersSuggestions'));
      return;
    }

    list.innerHTML = orders.map(orderCardHTML).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><p>Could not load your orders.</p></div>';
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin — Add product
// ═══════════════════════════════════════════════════════════════════════════

async function addProduct(event) {
  event.preventDefault();
  const product = {
    name: document.getElementById('prodName').value.trim(),
    price: parseFloat(document.getElementById('prodPrice').value),
    image: document.getElementById('prodImage').value.trim() ||
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    category: document.getElementById('prodCategory').value,
    description: document.getElementById('prodDesc').value.trim(),
  };

  try {
    const res = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    if (res.status === 401 || res.status === 403) {
      showToast('Atelier access required');
      openAuth();
      return;
    }
    if (res.ok) {
      showToast('Piece added to the collection');
      event.target.reset();
      navigateTo('home');
    } else {
      const data = await res.json();
      showToast(data.error || 'Could not add product');
    }
  } catch (err) {
    showToast('Could not add product');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin panel — tabs, dashboard, charts, orders
// ═══════════════════════════════════════════════════════════════════════════

function adminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  ['overview', 'orders', 'add'].forEach(id => {
    const el = document.getElementById('admin' + id[0].toUpperCase() + id.slice(1));
    if (el) el.classList.toggle('active', id === tab);
  });
  if (tab === 'orders') loadAdminOrders();
  if (tab === 'overview') loadAdminDashboard();
}

async function loadAdminOrders() {
  const list = document.getElementById('adminOrdersList');
  list.innerHTML = '<div class="empty-state"><p>Loading orders...</p></div>';
  try {
    const res = await apiFetch('/orders');
    if (!res.ok) {
      list.innerHTML = '<div class="empty-state"><p>Could not load orders.</p></div>';
      return;
    }
    const orders = await res.json();
    if (orders.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${svgIcon('box')}</div>
          <h3 class="empty-title">No customer orders yet</h3>
          <p class="empty-sub">Orders will appear here as customers check out.</p>
        </div>
      `;
      return;
    }
    list.innerHTML = orders.map(orderCardHTML).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><p>Could not load orders.</p></div>';
  }
}

async function loadAdminDashboard() {
  const statIds = ['statRevenue', 'statOrders', 'statUnits', 'statProducts'];
  statIds.forEach(id => document.getElementById(id).textContent = '—');

  try {
    const res = await apiFetch('/stats');
    if (!res.ok) {
      showToast('Could not load statistics');
      return;
    }
    const s = await res.json();

    document.getElementById('statRevenue').textContent = `$${s.totalRevenue.toFixed(2)}`;
    document.getElementById('statOrders').textContent = s.totalOrders;
    document.getElementById('statUnits').textContent = s.totalUnits;
    document.getElementById('statProducts').textContent = s.totalProducts;

    renderAdminCharts(s);
  } catch (err) {
    showToast('Could not load statistics');
  }
}

function destroyChart(name) {
  if (chartInstances[name]) {
    chartInstances[name].destroy();
    delete chartInstances[name];
  }
}

function renderAdminCharts(s) {
  if (typeof Chart === 'undefined') return;  // Chart.js not loaded (offline)

  // Luxury chart defaults — gold on charcoal
  Chart.defaults.color = '#c8bfae';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = '#1c1812';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(201, 163, 92, 0.45)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = '#e8d3a0';
  Chart.defaults.plugins.tooltip.bodyColor = '#f1ebdf';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;

  const ink = '#f1ebdf';
  const muted = '#847b6b';
  const grid = 'rgba(241, 235, 223, 0.08)';
  const gold = '#c9a35c';

  // ── Revenue over the last 14 days (single series → one hue, no legend)
  destroyChart('revenue');
  chartInstances.revenue = new Chart(document.getElementById('chartRevenue'), {
    type: 'bar',
    data: {
      labels: s.daily.map(d => d.label),
      datasets: [{
        label: 'Revenue',
        data: s.daily.map(d => Math.round(d.revenue * 100) / 100),
        backgroundColor: gold,
        hoverBackgroundColor: '#e8d3a0',
        borderRadius: 3,
        maxBarThickness: 40,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `  Revenue: $${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: muted } },
        y: {
          grid: { color: grid },
          border: { display: false },
          ticks: {
            color: muted,
            callback: v => '$' + v.toLocaleString(),
          },
        },
      },
    },
  });

  // ── Top products by units sold (single hue, direct labels)
  destroyChart('topProducts');
  const top = s.topProducts.length ? s.topProducts : [{ name: 'No sales yet', qty: 0 }];
  chartInstances.topProducts = new Chart(document.getElementById('chartTopProducts'), {
    type: 'bar',
    data: {
      labels: top.map(p => p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name),
      datasets: [{
        label: 'Units sold',
        data: top.map(p => p.qty),
        backgroundColor: gold,
        hoverBackgroundColor: '#e8d3a0',
        borderRadius: 3,
        maxBarThickness: 40,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `  ${ctx.parsed.x} units sold` } },
      },
      scales: {
        x: {
          grid: { color: grid },
          border: { display: false },
          ticks: { color: muted, precision: 0 },
        },
        y: { grid: { display: false }, ticks: { color: ink } },
      },
    },
  });

  // ── Revenue by category (golden palette, legend + data table)
  destroyChart('category');
  const cat = s.revenueByCategory.length ? s.revenueByCategory : [{ category: 'No sales yet', revenue: 0 }];
  const catColors = ['#c9a35c', '#e8d3a0', '#9c7b38', '#6f5b2e', '#d9c58a'];
  chartInstances.category = new Chart(document.getElementById('chartCategory'), {
    type: 'doughnut',
    data: {
      labels: cat.map(c => c.category),
      datasets: [{
        data: cat.map(c => Math.round(c.revenue * 100) / 100),
        backgroundColor: cat.map((_, i) => catColors[i % catColors.length]),
        borderColor: '#0b0a09',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: ink, boxWidth: 14, padding: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => `  ${ctx.label}: $${ctx.parsed.toFixed(2)} (${ctx.dataset.data.reduce((a, b) => a + b, 0) ? Math.round(ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0) * 100) : 0}%)`,
          },
        },
      },
    },
  });

  // Accessible data table (relief for low-contrast categorical fills)
  const table = document.getElementById('categoryTable');
  const total = cat.reduce((a, c) => a + c.revenue, 0);
  table.innerHTML = `
    <thead><tr><th>Category</th><th>Revenue</th><th>Share</th></tr></thead>
    <tbody>
      ${cat.map(c => `
        <tr>
          <td>${c.category}</td>
          <td>$${c.revenue.toFixed(2)}</td>
          <td>${total ? Math.round(c.revenue / total * 100) : 0}%</td>
        </tr>
      `).join('')}
      <tr class="chart-table-total"><td>Total</td><td>$${total.toFixed(2)}</td><td>100%</td></tr>
    </tbody>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// Suggested products — premium empty-state filler
// ═══════════════════════════════════════════════════════════════════════════

async function renderSuggestions(el, count = 4) {
  if (!el) return;
  try {
    const res = await fetch(`${API}/products`);
    if (!res.ok) return;
    const products = await res.json();
    const picks = products.slice(0, count);
    if (!picks.length) return;
    el.innerHTML = `
      <p class="suggestion-title">You may also like</p>
      <div class="suggestion-grid">
        ${picks.map(p => `
          <div class="suggestion-card" onclick="viewProduct(${p.id})">
            <div class="suggestion-img-wrap">
              <img src="${imgUrl(p.image, 300)}" alt="${p.name}" loading="lazy">
              <button class="suggestion-add" onclick="addToCart(${p.id}, event)" aria-label="Add ${p.name} to cart">${svgIcon('bag')}</button>
            </div>
            <span class="suggestion-name">${p.name}</span>
            <span class="suggestion-price">$${p.price.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <button class="btn-secondary continue-btn" onclick="navigateTo('home')">Continue Shopping</button>
    `;
  } catch (err) { /* ignore — suggestions are a bonus */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Reveal-on-scroll — fade + rise once, then returns to normal transitions
// ═══════════════════════════════════════════════════════════════════════════

function observeReveals(root) {
  if (!root) return;
  const els = root.querySelectorAll('.reveal:not(.in)');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.remove('reveal'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in');
      // Wait out the reveal transition (+ its stagger delay) before letting the
      // element return to its normal hover transitions.
      const delay = parseInt(el.style.getPropertyValue('--reveal-delay')) || 0;
      setTimeout(() => el.classList.remove('reveal'), 1300 + delay);
      io.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
  els.forEach(el => io.observe(el));
}

// ═══════════════════════════════════════════════════════════════════════════
// Button ripple
// ═══════════════════════════════════════════════════════════════════════════

function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest(
      '.btn-gold, .btn-outline, .btn-primary, .btn-secondary, .checkout-btn, .clear-btn, .add-cart-btn, .newsletter-submit, .link-btn'
    );
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size / 2) + 'px';
    span.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Newsletter
// ═══════════════════════════════════════════════════════════════════════════

function subscribeNewsletter(event) {
  event.preventDefault();
  const input = document.getElementById('newsletterEmail');
  const note = document.getElementById('newsletterNote');
  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address');
    return;
  }
  input.value = '';
  note.textContent = "You're on the list. Welcome.";
  showToast('Welcome to Exclusive Access');
}

// ═══════════════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadAuth();
  loadConfig();
  loadProducts();
  updateCartCount();

  initRipple();
  observeReveals(document);

  // Deepen the navbar glass once the page scrolls
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  // Static empty-state icon in the cart page
  const emptyIcon = document.getElementById('emptyCartIcon');
  if (emptyIcon) emptyIcon.innerHTML = svgIcon('bag');

  // Handle returning from a Stripe payment
  if (!handleCheckoutCancel()) {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (sessionId) {
      // Land on the checkout page with the success state
      navigateTo('checkout');
      verifyCheckout(sessionId);
      history.replaceState({}, '', '/');
    }
  }
});
