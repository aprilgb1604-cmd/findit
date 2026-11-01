const Notification = require('../models/Notification')

exports.getMyNotifications = async (req, res) => {
  try {
    const list = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
    res.json(list)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true })
    res.json({ message: 'All marked as read' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}