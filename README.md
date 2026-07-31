# Veloura

A full-stack e-commerce storefront with authentication, a shopping cart, checkout (mock or real Stripe payments), order history, and an admin dashboard with sales analytics — built with a plain HTML/CSS/JS frontend and an Express backend.

**Live demo:** _add your deployed link here_

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## Features

**Storefront**
- Browse products with category filters and live search
- Product detail views with ratings and reviews
- Persistent cart (add, update quantity, remove)

**Accounts**
- Register / log in with JWT-based sessions
- Passwords hashed with bcrypt
- Two roles out of the box: `user` and `admin`

**Checkout**
- Real payments via Stripe Checkout when API keys are configured
- Automatic fallback to a built-in mock checkout when no keys are set — great for local demos
- Address collection and order confirmation

**Orders**
- Customers can view their own order history
- Admins can view all orders across the store

**Admin dashboard**
- Add / remove products
- Sales stats: total revenue, units sold, order count
- Charts (via Chart.js): daily revenue trend, top-selling products, revenue by category

---

## Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | HTML, CSS, vanilla JavaScript, [Chart.js](https://www.chartjs.org/) |
| Backend  | Node.js, [Express 5](https://expressjs.com/) |
| Auth     | JWT (`jsonwebtoken`), password hashing (`bcryptjs`) |
| Payments | [Stripe](https://stripe.com/) (optional; mock checkout otherwise) |
| Data     | In-memory (no database — resets on server restart) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later

### Installation

```bash
git clone https://github.com/<your-username>/veloura.git
cd veloura/ecommerce-backend
npm install
```

### Configuration

Copy the example environment file and edit as needed:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port the server listens on (default `3000`) | No |
| `STRIPE_SECRET_KEY` | Stripe secret key — enables real payments | No |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | No |
| `JWT_SECRET` | Secret used to sign auth tokens | Recommended for production |

> Leave the Stripe keys blank to run entirely in **mock checkout mode** — no external account needed to try the app.

### Run

```bash
npm start
```

The server starts at `http://localhost:3000` and serves both the API and the frontend.

### Demo accounts

| Role  | Email | Password |
|-------|-------|----------|
| Admin | `admin@veloura.com` | `admin123` |
| User  | `user@demo.com` | `user123` |

---

## Project Structure

```
veloura/
├── ecommerce-backend/
│   ├── server.js          # Express app: auth, products, cart, checkout, orders, stats
│   ├── package.json
│   └── .env                # Local config (not committed)
└── ecommerce-frontend/
    ├── index.html
    ├── app.js               # SPA-style routing, rendering, API calls
    └── style.css
```

---

## API Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create an account | — |
| POST | `/api/auth/login` | Log in | — |
| GET | `/api/auth/me` | Get current user | User |
| GET | `/api/products` | List products (filter by `category`, `search`) | — |
| GET | `/api/products/:id` | Get one product | — |
| POST | `/api/products` | Create a product | Admin |
| DELETE | `/api/products/:id` | Delete a product | Admin |
| GET / POST | `/api/cart` | View / add to cart | — |
| PUT / DELETE | `/api/cart/:productId` | Update / remove cart item | — |
| GET | `/api/config` | Frontend payment mode (mock vs. Stripe) | — |
| POST | `/api/checkout` | Start checkout (Stripe session or mock order) | User |
| GET | `/api/checkout/verify` | Confirm a Stripe payment | User |
| GET | `/api/orders` | List orders (own, or all for admins) | User |
| GET | `/api/stats` | Sales analytics for the dashboard | Admin |

---

## Notes

- Data (products, users, cart, orders) is stored **in memory** and resets whenever the server restarts. Swap in a database for persistence.
- Stripe integration uses [Checkout Sessions](https://stripe.com/docs/payments/checkout) in test mode — use [Stripe test cards](https://stripe.com/docs/testing) if you enable it.
- Change `JWT_SECRET` before deploying anywhere public.

## License

ISC
