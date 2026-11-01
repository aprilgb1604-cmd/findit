const router = require('express').Router()
const c = require('../controllers/notificationController')
const { protect } = require('../middleware/auth')

router.get('/', protect, c.getMyNotifications)
router.patch('/read-all', protect, c.markAllRead)

module.exports = router