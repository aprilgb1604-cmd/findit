const router = require('express').Router()
const c = require('../controllers/itemController')
const { protect, authorize } = require('../middleware/auth')
const uploadPhoto = require('../middleware/upload')

router.get('/', c.getItems)
router.get('/stats', c.getStats)
router.get('/mine', protect, c.getMyItems)
router.get('/admin/all', protect, authorize('admin', 'staff'), c.getAllItemsAdmin)
router.get('/:id', c.getItem)

router.post('/', protect, uploadPhoto, c.createItem)
router.patch('/:id/verify', protect, authorize('admin', 'staff'), c.verifyItem)
router.patch('/:id/reject', protect, authorize('admin', 'staff'), c.rejectItem)
router.patch('/:id/hide', protect, authorize('admin', 'staff'), c.hideItem)
router.patch('/:id/status', protect, authorize('admin', 'staff'), c.updateStatus)

module.exports = router