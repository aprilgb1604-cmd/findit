const mongoose = require('mongoose')
const Claim = require('../models/Claim')
const Item = require('../models/Item')
const User = require('../models/User')
const Notification = require('../models/Notification')
const { uploadImage } = require('../config/cloudinary')

// sends the same notification to every admin and staff member
const notifyStaff = async (message) => {
  const staff = await User.find({ role: { $in: ['admin', 'staff'] } }).select('_id')
  if (staff.length) {
    await Notification.insertMany(staff.map((s) => ({ user: s._id, message })))
  }
}

// LOGGED IN: owner claims a FOUND item
exports.createClaim = async (req, res) => {
  try {
    const { itemId, proof } = req.body
    if (!itemId || !proof) {
      return res.status(400).json({ message: 'Item and proof are required' })
    }
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({ message: 'Item not found' })
    }

    const item = await Item.findById(itemId)
    if (!item || !item.verified) return res.status(404).json({ message: 'Item not found' })
    if (item.type !== 'found' || item.status !== 'Found') {
      return res.status(400).json({ message: 'This item cannot be claimed' })
    }
    if (String(item.reportedBy) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot claim your own report' })
    }

    const existing = await Claim.findOne({
      item: itemId,
      claimant: req.user._id,
      kind: { $ne: 'found_report' },
      status: 'Pending',
    })
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending claim on this item' })
    }

    const claim = await Claim.create({ item: itemId, claimant: req.user._id, kind: 'claim', proof })
    await notifyStaff(`${req.user.name} submitted a claim for "${item.title}". Please review it.`)
    res.status(201).json(claim)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// LOGGED IN: finder says "I found this" on a LOST item (photo optional)
exports.createFoundReport = async (req, res) => {
  try {
    const { itemId, message } = req.body
    if (!itemId || !message) {
      return res.status(400).json({ message: 'Item and message are required' })
    }
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({ message: 'Item not found' })
    }

    const item = await Item.findById(itemId)
    if (!item || !item.verified) return res.status(404).json({ message: 'Item not found' })
    if (item.type !== 'lost' || item.status !== 'Lost') {
      return res.status(400).json({ message: 'This item is not currently reported as lost' })
    }
    if (String(item.reportedBy) === String(req.user._id)) {
      return res.status(400).json({ message: 'This is your own report. Use "I got it back" instead' })
    }

    const existing = await Claim.findOne({
      item: itemId,
      claimant: req.user._id,
      kind: 'found_report',
      status: { $in: ['Pending', 'Approved'] },
    })
    if (existing) {
      return res.status(400).json({ message: 'You already reported this item' })
    }

    let photoUrl = ''
    if (req.file) {
      try {
        photoUrl = await uploadImage(req.file.buffer)
      } catch (err) {
        return res.status(500).json({ message: 'Photo upload failed. Check your Cloudinary settings.' })
      }
    }

    const report = await Claim.create({
      item: itemId,
      claimant: req.user._id,
      kind: 'found_report',
      proof: message,
      photoUrl,
    })
    await notifyStaff(`${req.user.name} says they found "${item.title}". Please review it.`)
    res.status(201).json(report)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// LOGGED IN: my own claims and found reports
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ claimant: req.user._id })
      .populate('item', 'title status')
      .sort({ createdAt: -1 })
    res.json(claims)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: all claims and found reports
exports.getAllClaims = async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate({
        path: 'item',
        select: 'title status location type reportedBy',
        populate: { path: 'reportedBy', select: 'name email' },
      })
      .populate('claimant', 'name email')
      .sort({ createdAt: -1 })
    res.json(claims)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// OWNER (or staff): who found my lost item? Only approved reports, and only for the owner
exports.getFinderContacts = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.itemId)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const item = await Item.findById(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'Item not found' })

    const isOwner = String(item.reportedBy) === String(req.user._id)
    const isStaff = ['admin', 'staff'].includes(req.user.role)
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const reports = await Claim.find({ item: item._id, kind: 'found_report', status: 'Approved' })
      .populate('claimant', 'name email')
      .sort({ createdAt: -1 })

    res.json(
      reports.map((r) => ({
        _id: r._id,
        message: r.proof,
        photoUrl: r.photoUrl,
        finder: { name: r.claimant?.name, email: r.claimant?.email },
        createdAt: r.createdAt,
      }))
    )
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// OWNER: "I got it back" -> item becomes Claimed
exports.gotItBack = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.itemId)) {
      return res.status(404).json({ message: 'Item not found' })
    }
    const item = await Item.findById(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'Item not found' })

    if (String(item.reportedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the owner can do this' })
    }
    if (item.type !== 'lost' || item.status !== 'Lost') {
      return res.status(400).json({ message: 'This item is not currently reported as lost' })
    }

    item.status = 'Claimed'
    item.resolvedAt = new Date()
    await item.save()

    // thank the approved finders
    const finders = await Claim.find({ item: item._id, kind: 'found_report', status: 'Approved' })
    for (const f of finders) {
      await Notification.create({
        user: f.claimant,
        message: `The owner confirmed they got "${item.title}" back. Thank you for helping!`,
      })
    }
    await notifyStaff(`${req.user.name} confirmed they got "${item.title}" back.`)

    res.json(item)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// STAFF/ADMIN: approve or reject a claim or a found report
exports.reviewClaim = async (req, res) => {
  try {
    const { status } = req.body
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' })
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Entry not found' })
    }

    const claim = await Claim.findById(req.params.id).populate('item')
    if (!claim) return res.status(404).json({ message: 'Entry not found' })
    if (!claim.item) return res.status(400).json({ message: 'The item no longer exists' })
    if (claim.status !== 'Pending') {
      return res.status(400).json({ message: 'This entry was already reviewed' })
    }
    if (String(claim.claimant) === String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot review your own submission' })
    }

    claim.status = status
    claim.reviewedBy = req.user._id
    await claim.save()

    const title = claim.item.title

    if (claim.kind === 'found_report') {
      if (status === 'Approved') {
        const finder = await User.findById(claim.claimant).select('name email')
        await Notification.create({
          user: claim.item.reportedBy,
          message: `Good news! ${finder?.name || 'Someone'} found "${title}". Contact them at ${finder?.email || 'the email shown on the item page'}, then press "I got it back" once you have it.`,
        })
        await Notification.create({
          user: claim.claimant,
          message: `Your report about "${title}" was approved. The owner can now contact you by email.`,
        })
      } else {
        await Notification.create({
          user: claim.claimant,
          message: `Your report about "${title}" was not approved.`,
        })
      }
      return res.json(claim)
    }

    // normal owner claim on a found item
    await Notification.create({
      user: claim.claimant,
      message: `Your claim for "${title}" was ${status.toLowerCase()}.`,
    })

    if (status === 'Approved') {
      await Item.findByIdAndUpdate(claim.item._id, { status: 'Claimed', resolvedAt: new Date() })
      const others = await Claim.find({
        item: claim.item._id,
        kind: { $ne: 'found_report' },
        status: 'Pending',
      })
      for (const o of others) {
        o.status = 'Rejected'
        o.reviewedBy = req.user._id
        await o.save()
        await Notification.create({
          user: o.claimant,
          message: `Your claim for "${title}" was rejected because another claim was approved.`,
        })
      }
    }

    res.json(claim)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}