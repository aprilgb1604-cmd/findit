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
    if (!itemId || typeof proof !== 'string' || !proof.trim()) {
      return res.status(400).json({ message: 'Item and written proof are required' })
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

    // A photo supports a claim but is not required; written proof is mandatory.
    let photoUrl = ''
    if (req.file) {
      try {
        photoUrl = await uploadImage(req.file.buffer)
      } catch (err) {
        return res.status(500).json({ message: 'Photo upload failed. Check your Cloudinary settings.' })
      }
    }

    const claim = await Claim.create({ item: itemId, claimant: req.user._id, kind: 'claim', proof: proof.trim(), photoUrl })
    await Notification.create({
      user: item.reportedBy,
      message: `Someone submitted an ownership claim for "${item.title}". Review the details on its item page.`,
    })
    await notifyStaff(`${req.user.name} submitted a claim for "${item.title}". Awaiting finder confirmation.`)
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

// FINDER: view ownership claims made against FOUND items they personally reported.
exports.getClaimsToConfirm = async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user._id, type: 'found' }).select('_id')
    const claims = await Claim.find({ item: { $in: items.map(i => i._id) }, kind: 'claim' })
      .populate('item', 'title status reportedBy')
      .populate('claimant', 'name')
      .sort({ createdAt: -1 })
    res.json(claims)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}


exports.decideFinderClaim = async (req, res) => {
  try {
    const { decision } = req.body

    if (!['Confirmed', 'Disputed'].includes(decision)) {
      return res.status(400).json({
        message: 'Invalid confirmation decision',
      })
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Claim not found',
      })
    }

    const claim = await Claim.findById(req.params.id)
      .populate('item')

    if (!claim || !claim.item || claim.kind !== 'claim') {
      return res.status(404).json({
        message: 'Claim not found',
      })
    }

    // Only the person who reported finding the item
    // is allowed to confirm its handover.
    if (
      String(claim.item.reportedBy) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        message: 'Only the original finder can confirm this claim',
      })
    }

    if (
      claim.status !== 'Pending' ||
      claim.item.status !== 'Found'
    ) {
      return res.status(409).json({
        message: 'This claim is no longer open',
      })
    }

    if (
      claim.finderDecision &&
      claim.finderDecision !== 'Pending'
    ) {
      return res.status(409).json({
        message: 'You have already reviewed this claim',
      })
    }

    const now = new Date()

    const changes = {
      finderDecision: decision,
      finderDecisionAt: now,
    }

    // A confirmed decision now means that the finder
    // verified the details AND handed over the item.
    if (decision === 'Confirmed') {
      changes.handedOverAt = now
    }

    // Atomically prevent duplicate finder decisions.
    const updated = await Claim.findOneAndUpdate(
      {
        _id: claim._id,
        status: 'Pending',
        finderDecision: { $in: ['Pending', null] },
      },
      {
        $set: changes,
      },
      {
        new: true,
      }
    )

    if (!updated) {
      return res.status(409).json({
        message: 'This claim has already been reviewed',
      })
    }

    if (decision === 'Confirmed') {
      await Notification.create({
        user: claim.claimant,
        message:
          `The finder confirmed that your ownership details ` +
          `matched and "${claim.item.title}" was handed over. ` +
          `Final admin approval is pending.`,
      })

      await notifyStaff(
        `${req.user.name} verified the claimant and confirmed ` +
        `physical handover of "${claim.item.title}". ` +
        `Please complete the admin review.`
      )
    } else {
      await Notification.create({
        user: claim.claimant,
        message:
          `The finder disputed your ownership claim for ` +
          `"${claim.item.title}". An admin will review it.`,
      })

      await notifyStaff(
        `${req.user.name} disputed an ownership claim for ` +
        `"${claim.item.title}".`
      )
    }

    return res.json(updated)
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    })
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

    // Found-item ownership claims require explicit confirmation from the original finder
    // before staff can approve. A disputed claim may still be rejected by staff.
    if (claim.kind === 'claim' && status === 'Approved') {
      if (claim.finderDecision !== 'Confirmed') {
        return res.status(409).json({ message: 'The original finder must confirm ownership before approval' })
      }
      if (claim.item.status !== 'Found') {
        return res.status(409).json({ message: 'The item is no longer available to claim' })
      }
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

/**
 * CLAIMANT: Get the original finder's contact details.
 *
 * Only the person whose ownership claim was approved
 * by an admin can access this information.
 *
 * Existing Lost-item and Found-item logic is unchanged.
 */
exports.getApprovedFinderContact = async (req, res) => {
  try {
    const { claimId } = req.params

    // Validate claim ID
    if (!mongoose.isValidObjectId(claimId)) {
      return res.status(404).json({
        message: 'Claim not found',
      })
    }

    // Find only an approved ownership claim belonging
    // to the currently logged-in user.
    const claim = await Claim.findOne({
      _id: claimId,
      claimant: req.user._id,
      kind: 'claim',
      status: 'Approved',
    }).populate('item', 'title type reportedBy')

    if (!claim || !claim.item || claim.item.type !== 'found') {
      return res.status(404).json({
        message: 'Approved claim not found',
      })
    }

    // Find the person who originally reported this item.
    const finder = await User.findById(
      claim.item.reportedBy
    ).select('name email')

    if (!finder) {
      return res.status(404).json({
        message: 'Finder contact information unavailable',
      })
    }

    return res.status(200).json({
      itemTitle: claim.item.title,
      finder: {
        name: finder.name,
        email: finder.email,
      },
    })
  } catch (err) {
    return res.status(500).json({
      message: 'Could not retrieve finder contact details',
    })
  }
}
