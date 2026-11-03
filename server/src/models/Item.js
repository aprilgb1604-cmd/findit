const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Electronics', 'Bags', 'Wallets & IDs', 'Clothing', 'Keys', 'Books', 'Others'],
    },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // stored as YYYY-MM-DD
    type: { type: String, enum: ['lost', 'found'], required: true },
    status: { type: String, enum: ['Lost', 'Found', 'Claimed', 'Returned'], required: true },
    photoUrl: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    verified: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false }, // admin took a public item offline
    resolvedAt: { type: Date }, // set when the item becomes Claimed or Returned
    resolutionMethod: {
  type: String,
  enum: ['in_person', 'online_claim'],
  default: null,
},
  },
  { timestamps: true }
)

module.exports = mongoose.model('Item', itemSchema)