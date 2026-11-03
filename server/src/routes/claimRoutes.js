
const router = require('express').Router()
const c = require('../controllers/claimController')
const { protect, authorize } = require('../middleware/auth')
const uploadPhoto = require('../middleware/upload')

// Existing claim submission routes
router.post('/', protect, uploadPhoto, c.createClaim)
router.post('/found-report', protect, uploadPhoto, c.createFoundReport)

// Existing claim and finder verification routes
router.get('/mine', protect, c.getMyClaims)
router.get('/to-confirm', protect, c.getClaimsToConfirm)
router.patch('/:id/finder-decision', protect, c.decideFinderClaim)

// NEW: only approved claimants can retrieve finder contact
router.get(
  '/approved-finder/:claimId',
  protect,
  c.getApprovedFinderContact
)

// Existing Lost-item routes
router.get('/finders/:itemId', protect, c.getFinderContacts)
router.patch('/got-it-back/:itemId', protect, c.gotItBack)

// Existing admin routes
router.get('/', protect, authorize('admin', 'staff'), c.getAllClaims)
router.patch('/:id', protect, authorize('admin', 'staff'), c.reviewClaim)

module.exports = router
