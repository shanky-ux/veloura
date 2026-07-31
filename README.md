<p align="center">
  <img src="./logo.svg" alt="Veloura — The Art of Fine Living" width="560">
</p>

<h1 align="center">Veloura</h1>

<p align="center">
  <em>Quiet luxury, curated for you.</em><br>
  A full-featured luxury e-commerce experience — <strong>Noir &amp; Gold</strong>, editorial, timeless.
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Node.js-18%2B-D4AF37?style=flat&logo=nodedotjs&logoColor=white&labelColor=111111" alt="Node.js 18+"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Express-5-D4AF37?style=flat&logo=express&logoColor=white&labelColor=111111" alt="Express 5"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Stripe-Ready-D4AF37?style=flat&logo=stripe&logoColor=white&labelColor=111111" alt="Stripe Ready"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Chart.js-Analytics-D4AF37?style=flat&logo=chartdotjs&logoColor=white&labelColor=111111" alt="Chart.js Analytics"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Auth-JWT-D4AF37?style=flat&logo=jsonwebtokens&logoColor=white&labelColor=111111" alt="JWT Auth"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Stack-Vanilla%20JS-D4AF37?style=flat&logo=javascript&logoColor=white&labelColor=111111" alt="Vanilla JS"></a>
</p>

---

**Veloura** is a complete, production-minded luxury storefront: a lightweight **Express** API serving a hand-crafted **vanilla frontend** — no build step, no framework overhead. It ships with a polished editorial design system, real payment support via Stripe (with a built-in mock fallback), JWT authentication, customer orders, and a full admin analytics dashboard.

> Originally *OmniRoute*, rebranded as **Veloura**.

---

## ✨ Features

- **Luxury design system** — Noir &amp; Gold palette (`#0B0B0B` / `#111111` / `#D4AF37`), Manrope + Inter typography, 4:5 editorial product crops, micro-interactions (reveal-on-scroll, ripple, glass navbar, quick-add hover).
- **Responsive storefront** — Home, product detail, cart, checkout, order history, admin. Every page mobile-ready.
- **Live search & filtering** — by keyword and category chips.
- **Cart** — session-based, quantity controls, subtotal, empty-state with suggested products.
- **Checkout** — shipping + payment form, card formatting, or **Stripe Checkout** when keys are configured.
- **Authentication** — register / login with **JWT** (7-day sessions), role-based admin access.
- **Order history** — customers see their own orders; admins see everything.
- **Admin dashboard** — revenue, orders, units sold, products, plus **Chart.js** visualizations (14-day revenue, top sellers, category share) with an accessible data table.
- **Demo-friendly** — runs instantly with seeded products and accounts; no external setup required.

## 🎨 Design system

| Token | Value |
|---|---|
| Background | `#0B0B0B` |
| Cards | `#111111` |
| Text | `#FFFFFF` |
| Secondary text | `#BEBEBE` |
| Accent (gold) | `#D4AF37` |
| Display type | Manrope (700–800) |
| Body type | Inter (400–500) |

Gold is used sparingly — only for what matters: prices, primary actions, active states, and the brand mark.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js · Express 5 · JSON Web Tokens · bcryptjs |
| Payments | Stripe (optional) + built-in mock checkout |
| Frontend | Vanilla HTML / CSS / JS (no framework, no build) |
| Charts | Chart.js 4 |
| Fonts | Manrope, Inter (Google Fonts) |

## 🚀 Getting started

```bash
# 1. Clone
git clone https://github.com/shanky-ux/veloura.git
cd veloura

# 2. Install & run the backend
cd ecommerce-backend
npm install
node server.js
```

Then open **http://localhost:3000** — the server also serves the frontend, so no separate dev server is needed.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@veloura.com` | `admin123` |
| Customer | `user@demo.com` | `user123` |

> Accounts are seeded fresh on every server start (in-memory store).

## 💳 Stripe (optional)

Veloura runs in **demo mode** by default — checkout is mocked and nothing is charged. To enable real payments, add keys in `ecommerce-backend/.env`:

```dotenv
PORT=3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Other optional variables:

| Var | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | random fallback | Signs session tokens |
| `BASE_URL` | `http://localhost:3000` | Redirect host for Stripe returns |

## 📁 Project structure

```
veloura/
├── ecommerce-backend/          # Express API + static file server
│   ├── server.js               # All routes, auth, checkout, stats
│   ├── package.json
│   └── .env                    # Local config (not committed)
├── ecommerce-frontend/         # Vanilla frontend
│   ├── index.html              # Pages: home, cart, detail, checkout, orders, admin
│   ├── style.css               # Noir & Gold design system
│   └── app.js                  # UI logic, API calls, charts
├── logo.svg                    # Brand mark used in this README
└── .gitignore
```

## 🔌 API reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create an account `{name, email, password}` |
| POST | `/auth/login` | — | Log in → `{token, user}` |
| GET | `/auth/me` | 🔒 | Current user |
| GET | `/products` | — | List products (`?category=`, `?search=`) |
| GET | `/products/:id` | — | Product detail |
| POST | `/products` | 🔒 Admin | Add a product |
| DELETE | `/products/:id` | 🔒 Admin | Remove a product |
| GET | `/cart` | — | Session cart |
| POST | `/cart` | — | `{productId, quantity}` |
| PUT | `/cart/:productId` | — | Update quantity |
| DELETE | `/cart/:productId` | — | Remove item |
| DELETE | `/cart` | — | Clear cart |
| GET | `/config` | — | Server config / Stripe status |
| POST | `/checkout` | 🔒 | Place order (mock) or start Stripe session |
| GET | `/checkout/verify?session_id=` | 🔒 | Confirm a Stripe payment |
| GET | `/orders` | 🔒 | Your orders (all orders for admins) |
| GET | `/stats` | 🔒 Admin | Dashboard analytics |

> Note: the cart is held in memory per running server — it resets on restart. Persist to a database for multi-instance production use.

## 📊 Admin analytics

Sign in with `admin@veloura.com` → **Admin** in the navbar. The dashboard includes:

- **KPI cards** — total revenue, orders, units sold, products
- **14-day revenue** bar chart
- **Top sellers** by units
- **Revenue by category** doughnut + data table

## 🛠 Scripts

| Command | Action |
|---|---|
| `node server.js` | Start the server on port 3000 |
| `npm start` | Same (alias in `package.json`) |

## 📄 License

© 2026 Veloura. This is a demo project — no license file is included. Reach out before using commercially.

---

<p align="center">
  <sub>Quiet luxury, curated for you — <strong>Veloura</strong>.</sub>
</p>
