const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', require('./src/routes/authRoutes'))
app.use('/api/items', require('./src/routes/itemRoutes'))
app.use('/api/claims', require('./src/routes/claimRoutes'))
app.use('/api/notifications', require('./src/routes/notificationRoutes'))
app.get('/api/health', (req, res) => res.json({ status: 'FindIt API running' }))

// In production, serve the built React app from this same server
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist')
  app.use(express.static(dist))
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const PORT = process.env.PORT || 5000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})