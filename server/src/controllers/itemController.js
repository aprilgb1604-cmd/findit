const mongoose = require('mongoose')
const Item = require('../models/Item')
const Notification = require('../models/Notification')
const { uploadImage } = require('../config/cloudinary')

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const Claim = require('../models/Claim')
const STATUSES = ['Lost', 'Found', 'Claimed', 'Returned']

// PUBLIC: verified items only, with search + filters
exports.getItems = async (req, res) => {
  try {
    const { search, category, location, type, date } = req.query
    const filter = { verified: true, hidden: { $ne: true } }
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' }
    if (category) filter.category = category
    if (location) filter.location = location
    if (type) filter.type = type
    if (date) filter.date = { $gte: date }

    // finished items disappear from the public list after a few hours
    const hours = Number(process.env.HIDE_AFTER_HOURS) || 6
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    filter.$or = [
      { status: { $in: ['Lost', 'Found'] } },
      { resolvedAt: { $gt: cutoff } },
    ]

    const items = await Item.find(filter)
      .populate('reportedBy', 'name')
      .sort({ createdAt: -1 })
    res.json(items)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUBLIC: counts for the home page
exports.getStats = async (req, res) => {
  try {
    const counts = await Item.aggregate([
      { $match: { verified: true, hidden: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const stats = { Lost: 0, Found: 0, Claimed: 0, Returned: 0 }
    counts.forEach((c) => { stats[c._id] = c.count })
    res.json(stats)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUBLIC: one verified item
exports.getItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const item = await Item.findById(req.params.id).populate('reportedBy', 'name')
    if (!item || !item.verified || item.hidden) {
      return res.status(404).json({ message: 'Item not found' })
    }
    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// LOGGED IN: my own reports
exports.getMyItems = async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user._id }).sort({ createdAt: -1 })
    res.json(items)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: every item, including unverified
exports.getAllItemsAdmin = async (req, res) => {
  try {
    const items = await Item.find()
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
    res.json(items)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// LOGGED IN: report a lost/found item (photo optional)
exports.createItem = async (req, res) => {
  try {
    const { title, description, category, location, date, type } = req.body
    if (!title || !description || !category || !location || !date || !type) {
      return res.status(400).json({ message: 'All fields are required' })
    }
    if (!['lost', 'found'].includes(type)) {
      return res.status(400).json({ message: 'Type must be lost or found' })
    }

    let photoUrl = ''
    if (req.file) {
      try {
        photoUrl = await uploadImage(req.file.buffer)
      } catch (err) {
        return res.status(500).json({ message: 'Photo upload failed. Check your Cloudinary settings.' })
      }
    }

    // reports from staff/admin are trusted; student reports wait for verification
    const trusted = ['admin', 'staff'].includes(req.user.role)

    const item = await Item.create({
      title, description, category, location, date, type, photoUrl,
      status: type === 'lost' ? 'Lost' : 'Found',
      reportedBy: req.user._id,
      verified: trusted,
    })
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// STAFF/ADMIN: approve a report (or show a hidden one again)
exports.verifyItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Item not found' })

    const wasHidden = item.verified && item.hidden
    item.verified = true
    item.rejected = false
    item.hidden = false
    await item.save()

    await Notification.create({
      user: item.reportedBy,
      message: wasHidden
        ? `Your report "${item.title}" is visible to the public again.`
        : `Your report "${item.title}" was verified and is now public.`,
    })
    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: reject a report instead of verifying it
exports.rejectItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const reason = (req.body.reason || '').trim()
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, verified: false },
      { rejected: true },
      { new: true }
    )
    if (!item) return res.status(404).json({ message: 'Item not found or already verified' })

    await Notification.create({
      user: item.reportedBy,
      message: `Your report "${item.title}" was rejected by an admin.${reason ? ' Reason: ' + reason : ''}`,
    })
    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: take a public item offline (it stays verified, just hidden)
exports.hideItem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, verified: true },
      { hidden: true },
      { new: true }
    )
    if (!item) return res.status(404).json({ message: 'Item not found or not public' })

    await Notification.create({
      user: item.reportedBy,
      message: `Your report "${item.title}" was removed from public view by an admin.`,
    })
    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: change status (Lost / Found / Claimed / Returned)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Item not found' })
    }

    const update = { status }
    update.resolvedAt = ['Claimed', 'Returned'].includes(status) ? new Date() : null
    const item = await Item.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!item) return res.status(404).json({ message: 'Item not found' })

    await Notification.create({
      user: item.reportedBy,
      message: `The status of "${item.title}" is now ${status}.`,
    })
    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * FINDER: Directly return a Found item in person.
 * No online ownership claim is required.
 */
exports.returnInPerson = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Item not found',
      })
    }

    // Only the original finder may mark their own
    // active Found item as returned.
    const item = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        reportedBy: req.user._id,
        type: 'found',
        status: 'Found',
        verified: true,
        hidden: { $ne: true },
      },
      {
        $set: {
          status: 'Returned',
          resolvedAt: new Date(),
          resolutionMethod: 'in_person',
        },
      },
      { new: true }
    )

    if (!item) {
      return res.status(409).json({
        message:
          'Only the original finder can return an active, verified Found item.',
      })
    }

    // Close any outstanding online ownership claims.
    const pending = await Claim.find({
      item: item._id,
      kind: 'claim',
      status: 'Pending',
    }).select('_id claimant')

    if (pending.length) {
      await Claim.updateMany(
        {
          _id: { $in: pending.map(c => c._id) },
          status: 'Pending',
        },
        {
          $set: { status: 'Rejected' },
        }
      )

      await Notification.insertMany(
        pending.map(c => ({
          user: c.claimant,
          message:
            `"${item.title}" was returned directly ` +
            'to its owner in person, so this ' +
            'online claim was closed.',
        }))
      )
    }

    // Notify admins/staff.
    const User = require('../models/User')

    const staff = await User.find({
      role: { $in: ['admin', 'staff'] },
    }).select('_id')

    if (staff.length) {
      await Notification.insertMany(
        staff.map(person => ({
          user: person._id,
          message:
            `The finder marked "${item.title}" ` +
            'as returned directly in person.',
        }))
      )
    }

    return res.json(item)
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    })
  }
}
