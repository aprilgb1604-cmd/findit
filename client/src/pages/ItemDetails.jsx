import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { categoryIcons } from '../data/mockItems'

const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-ink focus:ring-2 focus:ring-gray-200'

export default function ItemDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  // owner claim form (for FOUND items)
  const [showClaim, setShowClaim] = useState(false)
  const [proof, setProof] = useState('')
  const [sent, setSent] = useState(false)

  // "I found this" form (for LOST items)
  const [showFound, setShowFound] = useState(false)
  const [foundMsg, setFoundMsg] = useState('')
  const [foundPhoto, setFoundPhoto] = useState(null)
  const [foundSent, setFoundSent] = useState(false)

  const [finders, setFinders] = useState([])
  const [myReport, setMyReport] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadItem = () =>
    api.get(`/items/${id}`)
      .then((res) => setItem(res.data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false))

  useEffect(() => {
    loadItem()
  }, [id])

  const myId = user?.id || user?._id
  const ownerId = item?.reportedBy?._id
  const isOwner = !!myId && !!ownerId && String(ownerId) === String(myId)
  const isStaff = !!user && ['admin', 'staff'].includes(user.role)

  // owner (or admin) can see the finders whose reports were approved
  useEffect(() => {
    if (!item || !user || item.type !== 'lost') return
    if (!isOwner && !isStaff) return
    api.get(`/claims/finders/${item._id}`)
      .then((res) => setFinders(res.data))
      .catch(() => {})
  }, [item, user])

  // has this user already sent a found report for this item?
  useEffect(() => {
    if (!item || !user || item.type !== 'lost') return
    api.get('/claims/mine')
      .then((res) => {
        const r = res.data.find(
          (c) => c.kind === 'found_report' && c.item?._id === item._id && c.status !== 'Rejected'
        )
        setMyReport(r || null)
      })
      .catch(() => {})
  }, [item, user])

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>

  if (!item) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Item not found.</p>
        <Link to="/" className="text-brand font-semibold underline">Back to browse</Link>
      </div>
    )
  }

  const canClaim = item.type === 'found' && item.status === 'Found'

  const submitClaim = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/claims', { itemId: item._id, proof })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit the claim')
    } finally {
      setBusy(false)
    }
  }

  const onFoundPhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB')
      e.target.value = ''
      return
    }
    setError('')
    setFoundPhoto(file)
  }

  const submitFound = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = new FormData()
      data.append('itemId', item._id)
      data.append('message', foundMsg)
      if (foundPhoto) data.append('photo', foundPhoto)
      await api.post('/claims/found-report', data)
      setFoundSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your report')
    } finally {
      setBusy(false)
    }
  }

  const gotItBack = async () => {
    if (!window.confirm('Confirm that you got this item back?')) return
    setError('')
    setBusy(true)
    try {
      await api.patch(`/claims/got-it-back/${item._id}`)
      await loadItem()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the item')
    } finally {
      setBusy(false)
    }
  }

  const errorBox = error && (
    <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2">{error}</p>
  )

  // what the visitor can do on this item
  let actions
  if (item.type === 'found') {
    actions = sent ? (
      <div className="bg-green-50 text-green-700 p-4 rounded-lg">
        ✅ Claim submitted! An admin will review it and you'll be notified.
      </div>
    ) : !canClaim ? (
      <p className="text-sm text-gray-400">This item can't be claimed right now.</p>
    ) : !user ? (
      <p className="text-sm text-gray-600">
        <Link to="/login" className="text-brand font-semibold underline">Log in</Link> to claim this item.
      </p>
    ) : showClaim ? (
      <form onSubmit={submitClaim} className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Describe proof that this item is yours
        </label>
        <textarea
          required
          rows={3}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="e.g. unique marks, what's inside, when and where you lost it"
          className={inputClass}
        />
        {errorBox}
        <button disabled={busy} className="bg-ink text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50">
          {busy ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>
    ) : (
      <button onClick={() => setShowClaim(true)} className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition">
        This is mine, claim it
      </button>
    )
  } else if (item.status !== 'Lost') {
    actions = <p className="text-sm text-gray-400">This item is no longer reported as lost.</p>
  } else if (!user) {
    actions = (
      <p className="text-sm text-gray-600">
        Found this item? <Link to="/login" className="text-brand font-semibold underline">Log in</Link> to tell the owner.
      </p>
    )
  } else if (isOwner) {
    actions = (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Got your item back, or found it yourself?</p>
        {errorBox}
        <button onClick={gotItBack} disabled={busy} className="bg-ink text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50">
          {busy ? 'Updating...' : '✅ I got it back'}
        </button>
      </div>
    )
  } else if (myReport) {
    actions = (
      <div className="bg-gray-100 text-gray-700 p-4 rounded-lg text-sm">
        {myReport.status === 'Approved'
          ? '✅ Your report was approved. The owner can now email you.'
          : '⏳ You already reported this item. It is waiting for admin review.'}
      </div>
    )
  } else if (foundSent) {
    actions = (
      <div className="bg-green-50 text-green-700 p-4 rounded-lg">
        ✅ Thank you! An admin will check your report. If approved, the owner will be able to email you.
      </div>
    )
  } else if (showFound) {
    actions = (
      <form onSubmit={submitFound} className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Tell us where and when you found it
        </label>
        <textarea
          required
          rows={3}
          value={foundMsg}
          onChange={(e) => setFoundMsg(e.target.value)}
          placeholder="e.g. Found it near the library stairs this morning, I have it with me"
          className={inputClass}
        />

        <div>
          <input id="found-photo" type="file" accept="image/*" onChange={onFoundPhoto} className="hidden" />
          <label htmlFor="found-photo" className="inline-flex items-center gap-2 cursor-pointer bg-gray-100 text-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 active:scale-95 transition">
            📷 {foundPhoto ? 'Change photo' : 'Add photo (optional)'}
          </label>
          {foundPhoto && <span className="ml-3 text-sm text-gray-500">{foundPhoto.name}</span>}
        </div>

        <p className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
          🔒 If an admin approves your report, your <b>name and email</b> will be shown to the owner so they can contact you.
        </p>

        {errorBox}
        <button disabled={busy} className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition disabled:opacity-50">
          {busy ? 'Sending...' : 'Send to admin'}
        </button>
      </form>
    )
  } else {
    actions = (
      <button onClick={() => setShowFound(true)} className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition">
        🙋 I found this
      </button>
    )
  }

  return (
    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="h-[28rem] bg-gray-100 grid place-items-center text-7xl overflow-hidden">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.title} className="max-w-full max-h-full object-contain" />
        ) : (
          categoryIcons[item.category] || '📦'
        )}
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink">{item.title}</h1>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-gray-600 mt-3">{item.description}</p>

        <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
          <div><span className="text-gray-400">Category</span><p className="font-semibold">{item.category}</p></div>
          <div><span className="text-gray-400">Location</span><p className="font-semibold">{item.location}</p></div>
          <div><span className="text-gray-400">Date</span><p className="font-semibold">{item.date}</p></div>
          <div><span className="text-gray-400">Reported by</span><p className="font-semibold">{item.reportedBy?.name || 'Unknown'}</p></div>
        </div>

        {/* Finder contact box: only the owner (or admin) sees this, only after approval */}
        {finders.length > 0 && (
          <div className="mt-6 border-2 border-ink rounded-xl p-4 bg-gray-50">
            <p className="font-bold text-ink mb-3">🎉 Someone found this item</p>
            <div className="space-y-4">
              {finders.map((f) => (
                <div key={f._id} className="text-sm">
                  <p><span className="text-gray-400">Found by </span><b>{f.finder?.name}</b></p>
                  <p>
                    <span className="text-gray-400">Email </span>
                    <a href={`mailto:${f.finder?.email}`} className="text-brand font-semibold hover:underline">{f.finder?.email}</a>
                  </p>
                  <p className="text-gray-600 mt-1">"{f.message}"</p>
                  {f.photoUrl && (
                    <a href={f.photoUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 text-brand font-semibold hover:underline">
                      View photo
                    </a>
                  )}
                </div>
              ))}
            </div>
            {isOwner && (
              <p className="text-xs text-gray-500 mt-3">
                Email them to arrange the handover, then press "I got it back" below.
              </p>
            )}
          </div>
        )}

        <div className="mt-6">{actions}</div>

        <Link to="/" className="inline-block mt-6 text-brand text-sm font-semibold hover:underline">← Back to browse</Link>
      </div>
    </div>
  )
}