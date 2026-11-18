# Brand order receipts

Encrypted customer order/receipt links for **Al Shantaf** (`alshantaf.com`) and **Al Wathba Steel Fiber** (`alwathbasteelfiber.com`).

## Admin (secret routes)

### Alshantaf
1. Unlock admin once: `https://alshantaf.com/admin/login?unlock=<ADMIN_GATE_SECRET>`
2. Open **Orders & receipts** (`/admin/orders`) — requires `orders` permission (or `*`).
3. Create an order → copy the share URL (`https://alshantaf.com/o/<token>`).

### Steel Fiber
1. Unlock admin: `https://alwathbasteelfiber.com/admin?gate=<ADMIN_GATE>`
2. Open **Customer receipts** (`#/brand-orders`).
3. Create an order → share URL is `https://alwathbasteelfiber.com/o/<token>`.

## Customer link
- View + print only (no online pay in v1).
- Kinds: payment history, installments (تقسيط), one-time, service.
- Rotate link from admin to revoke the previous token.

## Env
| Variable | Where | Purpose |
|----------|--------|---------|
| `PUBLIC_SITE_URL` | Alshantaf backend | Alshantaf link base |
| `STEELFIBER_PUBLIC_SITE_URL` | Alshantaf backend | Steel Fiber link base |
| `STEELFIBER_ORDERS_ADMIN_KEY` | Both apps (same value) | Steel Fiber admin → API auth |
| `ALSHANTAF_ORDERS_API_URL` | wsteelfiber | Upstream API (`http://backend:4000`) |

Nginx on `alwathbasteelfiber.com` proxies `/o/` → Alshantaf frontend and `/api/public/orders/` → Alshantaf backend.
