import express from 'express'
import dotenv from 'dotenv'
import { pool, query } from './src/config/db.js'
import admin from './src/modules/admins/admin.route.js'
import orders from './src/modules/orders/order.route.js'
import payments from './src/modules/payments/payment.route.js'
import products from './src/modules/products/product.route.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000


app.get('/', (req, res) => {
  res.send('Hello, World!')
})

app.get('/api/admin',admin)
app.get('/api/orders',orders)
app.get('/api/payments',payments)
app.get('/api/products',products)



async function start() {
  try {
    const hasConnString = Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL)
    if (!hasConnString) {
      console.warn('No DATABASE_URL or NEON_DATABASE_URL found. Starting server without DB connection.')
    } else {
      const result = await query('SELECT NOW()')
      console.log('Database connected, time:', result.rows[0])
      app.locals.db = pool
    }

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to connect to the database. Server will not start.', err)
    process.exit(1)
  }
}

start()

