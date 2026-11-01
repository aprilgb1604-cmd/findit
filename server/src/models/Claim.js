const mongoose = require('mongoose')

const claimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'claim' = owner claims a found item, 'found_report' = finder says they found a lost item
    kind: { type: String, enum: ['claim', 'found_report'], default: 'claim' },
    proof: { type: String, required: true, trim: true }, // owner's proof, or the finder's message
    photoUrl: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Claim', claimSchema)