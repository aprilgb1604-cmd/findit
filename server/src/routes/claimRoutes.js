const router = require('express').Router()
const c = require('../controllers/claimController')
const { protect, authorize } = require('../middleware/auth')
const uploadPhoto = require('../middleware/upload')

router.post('/', protect, c.createClaim)
router.post('/found-report', protect, uploadPhoto, c.createFoundReport)
router.get('/mine', protect, c.getMyClaims)
router.get('/finders/:itemId', protect, c.getFinderContacts)
router.patch('/got-it-back/:itemId', protect, c.gotItBack)

router.get('/', protect, authorize('admin', 'staff'), c.getAllClaims)
router.patch('/:id', protect, authorize('admin', 'staff'), c.reviewClaim)

module.exports = router