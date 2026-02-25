

Project Structure:

```
merch-backend/
│
├── src/
│   ├── config/
│   │     └── db.js
│   │
│   ├── middleware/
│   │     ├── auth.middleware.js
│   │     ├── role.middleware.js
│   │     └── error.middleware.js
│   │
│   ├── modules/
│   │     ├── products/
│   │     │     ├── product.controller.js
│   │     │     ├── product.service.js
│   │     │     └── product.routes.js
│   │     │
│   │     ├── orders/
│   │     │     ├── order.controller.js
│   │     │     ├── order.service.js
│   │     │     └── order.routes.js
│   │     │
│   │     ├── payments/
│   │     │     ├── payment.controller.js
│   │     │     ├── payment.service.js
│   │     │     └── payment.routes.js
│   │     │
│   │     ├── admins/
│   │     │     ├── admin.controller.js
│   │     │     ├── admin.service.js
│   │     │     └── admin.routes.js
│   │     │
│   │     └── audit/
│   │           └── audit.service.js
│   │
│   ├── utils/
│   │     └── logger.js
│   │
│   └── app.js
│
├── server.js
├── package.json
└── .env

```


Routes Required

## 3. Public routes (no auth)

These endpoints are used by buyers.

- Products
	- GET    /api/products
	- GET    /api/products/:id

- Create Order
	- POST   /api/orders

	Body (JSON):

	{
		"full_name": "string",
		"roll_number": "string",
		"phone": "string",
		"email": "string",
		"items": [
			{ "product_variant_id": number, "quantity": number }
		]
	}

	Backend must:
	- Validate incoming payload (use Joi or Zod). Reject invalid input with 4xx.
	- Validate stock for each item.
	- Calculate totals on the server (never trust frontend price).
	- Use a DB transaction to:
		- Insert order (status = 'pending').
		- Insert order_items for each item.
		- Reduce stock atomically (fail whole transaction if any item is out of stock).

	Critical: Do all DB writes above inside a single transaction to maintain atomicity.

- Submit Payment
	- POST /api/payments

	Body (JSON):
	{
		"order_id": number,
		"upi_account_id": number,
		"upi_transaction_id": "string",
		"amount_paid": number
	}

	Backend must (transactional):
	- Check that order exists and order.status === 'pending'.
	- Validate amount_paid === order.total_amount (server-calculated).
	- Ensure upi_transaction_id is unique (DB unique index on payments.upi_transaction_id).
	- Insert payment record and update order.status → 'payment_submitted'.
	- Wrap in a transaction and handle unique-constraint errors gracefully (409 conflict).

	Additional protections:
	- Rate-limit payment submissions (per IP or per order) to reduce fraud/abuse.
	- Sanitize and validate all inputs.

## 4. Admin Authentication

- Admin Login
	- POST /api/admin/login

	Returns a JWT token. Recommended storage:
	- HttpOnly secure cookie (preferred)
	- or Authorization: Bearer <token>

	JWT should include admin id and role (e.g., { id, role }). Use a strong JWT_SECRET and expiration.

## 5. Auth & Role middleware

- `auth.middleware.js`
	- Extract token from HttpOnly cookie or Authorization header.
	- Verify JWT (JWT_SECRET).
	- Load admin record from DB and attach to `req.admin` (or `req.user`).

- `role.middleware.js`
	- Export helper like `allowRoles('super_admin')` or `allowRoles('normal_admin')`.
	- Check `req.admin.role` and reject with 403 if not permitted.

Usage: Protect admin routes with auth middleware then role checks.

## 6. Admin routes (authenticated)

- Get Pending Payments
	- GET /api/admin/payments?status=submitted

	Service logic:
	- If `admin.role === 'normal_admin'` → filter payments where upi_account.assigned_admin_id = admin.id.
	- If `super_admin` → no filter (see query param `status` for submitted/verified/rejected).

- Verify Payment
	- PATCH /api/admin/payments/:id/verify

	Backend must (transactional):
	- Check payment exists and payment.status === 'submitted'.
	- Update payment.status → 'verified'.
	- Update related order.status → 'verified'.
	- Save who verified (verified_by admin id) and timestamp.
	- Insert an audit log record.
	- All inside one DB transaction.

- Reject Payment
	- PATCH /api/admin/payments/:id/reject

	Backend must (transactional):
	- Update payment.status → 'rejected'.
	- Update related order.status → 'rejected'.
	- Save rejection_reason and who rejected.
	- Insert an audit log record.

## 7. UPI Management (admin-only)

Super admin only:
- POST   /api/admin/upi
- PATCH  /api/admin/upi/:id
- GET    /api/admin/upi

Normal admins must not be allowed to create or edit UPI accounts.

## 8. Critical backend logic (non-negotiable)

- Always use DB transactions for multi-step operations (orders, payments, stock updates).
- Add a unique index on payments.upi_transaction_id to enforce uniqueness at DB level.
- Ensure stock deductions are atomic (select ... for update or use appropriate locking).
- Validate input with Joi or Zod and fail fast.
- Apply rate limiting on payment submission endpoints.
- Sanitize inputs to prevent injection.
- Properly handle and map DB errors (unique-violation => 409 conflict, foreign-key => 400/404 as appropriate).

## 9. Example middleware logic (conceptually)

auth.middleware.js (concept):

```js
// extract token from cookie or header
// verify with jwt
// fetch admin from DB
// attach to req.admin
```

role.middleware.js (concept):

```js
function allowRoles(...roles) {
	return (req, res, next) => {
		if (!req.admin || !roles.includes(req.admin.role)) return res.sendStatus(403)
		next()
	}
}
```

## 10. Error handling

Add a central error handler in `error.middleware.js` and mount it last in the middleware chain:

```js
app.use((err, req, res, next) => {
	logger.error(err)
	res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})
```

Do not expose stack traces in production.

## DB Transaction example (pg)

```js
import { pool } from './src/config/db.js'

async function createOrder(orderPayload) {
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		// perform validations, inserts, stock updates using client.query(...)
		await client.query('COMMIT')
	} catch (err) {
		await client.query('ROLLBACK')
		throw err
	} finally {
		client.release()
	}
}
```

## Misc notes

- Use secure HttpOnly cookies for JWTs in production and set SameSite and Secure flags.
- Consider using an audit table for all admin actions (who, when, what changed).
- For serverless deployments with Neon, review their recommended pooling strategy (serverless adapters) to avoid connection exhaustion.

---

Additions above implement the API contract, security, and transactional guarantees required for a reliable payment/order system. Keep the README up-to-date as implementation details evolve.