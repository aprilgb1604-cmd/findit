
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

  // Owner claim form for FOUND items
  const [showClaim, setShowClaim] = useState(false)
  const [proof, setProof] = useState('')
  const [claimPhoto, setClaimPhoto] = useState(null)
  const [claimPreview, setClaimPreview] = useState('')
  const [sent, setSent] = useState(false)

  // "I found this" form for LOST items
  const [showFound, setShowFound] = useState(false)
  const [foundMsg, setFoundMsg] = useState('')
  const [foundPhoto, setFoundPhoto] = useState(null)
  const [foundSent, setFoundSent] = useState(false)

  const [finders, setFinders] = useState([])
  const [finderClaims, setFinderClaims] = useState([])
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

  useEffect(() => {
    if (!claimPhoto) {
      setClaimPreview('')
      return
    }

    const url = URL.createObjectURL(claimPhoto)
    setClaimPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [claimPhoto])

  const myId = user?.id || user?._id
  const ownerId = item?.reportedBy?._id
  const isOwner =
    !!myId && !!ownerId &&
    String(ownerId) === String(myId)

  const isStaff =
    !!user && ['admin', 'staff'].includes(user.role)

  // Existing LOST item finder contact functionality
  useEffect(() => {
    if (!item || !user || item.type !== 'lost') return
    if (!isOwner && !isStaff) return

    api.get(`/claims/finders/${item._id}`)
      .then((res) => setFinders(res.data))
      .catch(() => {})
  }, [item, user])

  // Original finder can see ownership claims
  // submitted against their FOUND item
  useEffect(() => {
    if (!item || !user ||
        item.type !== 'found' || !isOwner) return

    api.get('/claims/to-confirm')
      .then((res) => {
        setFinderClaims(
          res.data.filter(
            (c) => c.item?._id === item._id
          )
        )
      })
      .catch(() => {})
  }, [item, user, isOwner])

  // Finder confirms that the ownership proof matches
  // AND the item has been physically handed over.
  const decideOwnership = async (claimId, decision) => {
    setBusy(true)
    setError('')

    try {
      await api.patch(
        `/claims/${claimId}/finder-decision`,
        { decision }
      )

      const res = await api.get('/claims/to-confirm')

      setFinderClaims(
        res.data.filter(
          (c) => c.item?._id === item._id
        )
      )
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not save your confirmation'
      )
    } finally {
      setBusy(false)
    }
  }

  // Existing LOST item found-report tracking
  useEffect(() => {
    if (!item || !user || item.type !== 'lost') return

    api.get('/claims/mine')
      .then((res) => {
        const r = res.data.find(
          (c) =>
            c.kind === 'found_report' &&
            c.item?._id === item._id &&
            c.status !== 'Rejected'
        )

        setMyReport(r || null)
      })
      .catch(() => {})
  }, [item, user])

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-16">
        Loading...
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">
          Item not found.
        </p>
        <Link
          to="/"
          className="text-brand font-semibold underline"
        >
          Back to browse
        </Link>
      </div>
    )
  }

  const canClaim =
    item.type === 'found' && item.status === 'Found'

  // Existing FOUND item ownership claim submission
  const submitClaim = async (e) => {
    e.preventDefault()
    setError('')

    if (!proof.trim()) {
      setError(
        'Please describe how you can prove this item is yours'
      )
      return
    }

    setBusy(true)

    try {
      const data = new FormData()
      data.append('itemId', item._id)
      data.append('proof', proof.trim())

      if (claimPhoto) {
        data.append('photo', claimPhoto)
      }

      await api.post('/claims', data)
      setSent(true)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not submit the claim'
      )
    } finally {
      setBusy(false)
    }
  }

  // Optional claim photo / camera
  const onClaimPhoto = (e) => {
    const file = e.target.files?.[0]

    if (!file) {
      setClaimPhoto(null)
      return
    }

    if (
      !file.type.startsWith('image/') ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Please select an image under 5 MB')
      setClaimPhoto(null)
      e.target.value = ''
      return
    }

    setError('')
    setClaimPhoto(file)
  }

  // Existing LOST item photo logic
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

  // Existing LOST item found-report submission
  const submitFound = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      const data = new FormData()
      data.append('itemId', item._id)
      data.append('message', foundMsg)

      if (foundPhoto) {
        data.append('photo', foundPhoto)
      }

      await api.post('/claims/found-report', data)
      setFoundSent(true)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not submit your report'
      )
    } finally {
      setBusy(false)
    }
  }

  // Existing LOST item recovery confirmation
  const gotItBack = async () => {
    if (
      !window.confirm(
        'Confirm that you got this item back?'
      )
    ) return

    setError('')
    setBusy(true)

    try {
      await api.patch(
        `/claims/got-it-back/${item._id}`
      )
      await loadItem()
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not update the item'
      )
    } finally {
      setBusy(false)
    }
  }
  
const returnInPerson = async () => {
  const confirmed = window.confirm(
    'Has the real owner collected this item in person, ' +
    'and have you checked that it belongs to them?\n\n' +
    'This will mark the item Returned and close ' +
    'pending online claims.'
  )

  if (!confirmed) return

  setError('')
  setBusy(true)

  try {
    await api.patch(
      `/items/${item._id}/returned-in-person`
    )

    await loadItem()
    setFinderClaims([])
  } catch (err) {
    setError(
      err.response?.data?.message ||
      'Could not mark this item returned'
    )
  } finally {
    setBusy(false)
  }
}


  const errorBox = error && (
    <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2">
      {error}
    </p>
  )

  // Actions shown based on item type and user
  let actions

  if (item.type === 'found') {
    actions = sent ? (
      <div className="bg-green-50 text-green-700 p-4 rounded-lg">
        ✅ Claim submitted! The finder will check your
        evidence and confirm handover. An admin will
        make the final decision.
      </div>
    ) : !canClaim ? (
      <p className="text-sm text-gray-400">
        This item can't be claimed right now.
      </p>
    ) : !user ? (
      <p className="text-sm text-gray-600">
        <Link
          to="/login"
          className="text-brand font-semibold underline"
        >
          Log in
        </Link>{' '}
        to claim this item.
      </p>

    // NEW: Finder must not see the claimant button
    ) : isOwner ? (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="font-semibold text-blue-900">
          📦 You reported finding this item
        </p>

        <p className="text-sm text-blue-700 mt-2">
          Review ownership claims above. Check the
          claimant's evidence, hand over the item,
          and confirm the handover using their claim card.
        </p>
      </div>

    ) : showClaim ? (
      <form
        onSubmit={submitClaim}
        className="space-y-3"
      >
        <label className="block text-sm font-semibold text-gray-700">
          Describe proof that this item is yours
        </label>

        <textarea
          required
          rows={3}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="Describe details that are not visible in the listing: unique marks, contents, serial number, and when/where you lost it"
          className={inputClass}
        />

        <div>
          <p className="block text-sm font-semibold text-gray-700 mb-2">
            Ownership proof photo{' '}
            <span className="text-gray-500 font-normal">
              (optional)
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              id="claim-photo"
              type="file"
              accept="image/*"
              onChange={onClaimPhoto}
              className="sr-only"
            />

            <label
              htmlFor="claim-photo"
              className="inline-flex items-center gap-2 cursor-pointer bg-gray-100 text-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              📎 Upload photo
            </label>

            <input
              id="claim-camera"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onClaimPhoto}
              className="sr-only"
            />

            <label
              htmlFor="claim-camera"
              className="inline-flex items-center gap-2 cursor-pointer bg-gray-100 text-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              📷 Take photo
            </label>
          </div>

          {claimPhoto && (
            <div className="mt-3 space-y-2">
              {claimPreview && (
                <img
                  src={claimPreview}
                  alt="Selected claim evidence"
                  className="max-h-48 max-w-full rounded-lg object-contain border border-gray-200"
                />
              )}

              <p className="text-sm text-gray-600 break-all">
                Selected: {claimPhoto.name}
              </p>

              <button
                type="button"
                onClick={() => {
                  setClaimPhoto(null)
                  document.getElementById(
                    'claim-photo'
                  ).value = ''
                  document.getElementById(
                    'claim-camera'
                  ).value = ''
                }}
                className="text-brand text-sm font-semibold underline"
              >
                Remove photo
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            No photo? You can still submit your claim
            using written details only. If you have one,
            upload or take a photo (maximum 5 MB).
            Do not upload IDs or sensitive documents:
            images currently use public URLs.
          </p>
        </div>

        {errorBox}

        <button
          disabled={busy || !proof.trim()}
          className="bg-ink text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50"
        >
          {busy ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>
    ) : (
      <button
        onClick={() => setShowClaim(true)}
        className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition"
      >
        Submit Ownership Claim
      </button>
    )

  // All existing LOST item actions preserved
  } else if (item.status !== 'Lost') {
    actions = (
      <p className="text-sm text-gray-400">
        This item is no longer reported as lost.
      </p>
    )
  } else if (!user) {
    actions = (
      <p className="text-sm text-gray-600">
        Found this item?{' '}
        <Link
          to="/login"
          className="text-brand font-semibold underline"
        >
          Log in
        </Link>{' '}
        to tell the owner.
      </p>
    )
  } else if (isOwner) {
    actions = (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Got your item back, or found it yourself?
        </p>

        {errorBox}

        <button
          onClick={gotItBack}
          disabled={busy}
          className="bg-ink text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50"
        >
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
        ✅ Thank you! An admin will check your report.
        If approved, the owner will be able to email you.
      </div>
    )
  } else if (showFound) {
    actions = (
      <form
        onSubmit={submitFound}
        className="space-y-3"
      >
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
          <input
            id="found-photo"
            type="file"
            accept="image/*"
            onChange={onFoundPhoto}
            className="hidden"
          />

          <label
            htmlFor="found-photo"
            className="inline-flex items-center gap-2 cursor-pointer bg-gray-100 text-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 active:scale-95 transition"
          >
            📷 {foundPhoto
              ? 'Change photo'
              : 'Add photo (optional)'}
          </label>

          {foundPhoto && (
            <span className="ml-3 text-sm text-gray-500">
              {foundPhoto.name}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
          🔒 If an admin approves your report, your{' '}
          <b>name and email</b> will be shown to
          the owner so they can contact you.
        </p>

        {errorBox}

        <button
          disabled={busy}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition disabled:opacity-50"
        >
          {busy ? 'Sending...' : 'Send to admin'}
        </button>
      </form>
    )
  } else {
    actions = (
      <button
        onClick={() => setShowFound(true)}
        className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark active:scale-95 transition"
      >
        🙋 I found this
      </button>
    )
  }

  return (
    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden">

      <div className="h-[28rem] bg-gray-100 grid place-items-center text-7xl overflow-hidden">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.title}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          categoryIcons[item.category] || '📦'
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink">
            {item.title}
          </h1>

          <StatusBadge status={item.status} />
        </div>

        <p className="text-gray-600 mt-3">
          {item.description}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
          <div>
            <span className="text-gray-400">
              Category
            </span>
            <p className="font-semibold">
              {item.category}
            </p>
          </div>

          <div>
            <span className="text-gray-400">
              Location
            </span>
            <p className="font-semibold">
              {item.location}
            </p>
          </div>

          <div>
            <span className="text-gray-400">
              Date
            </span>
            <p className="font-semibold">
              {item.date}
            </p>
          </div>

          <div>
            <span className="text-gray-400">
              Reported by
            </span>
            <p className="font-semibold">
              {item.reportedBy?.name || 'Unknown'}
            </p>
          </div>
        </div>

        {/* NEW: Finder verification and handover */}
        {item.type === 'found' && isOwner && (
          <div className="mt-6 border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">

            <h2 className="font-bold text-ink text-lg">
              📦 Ownership Claims Received
            </h2>

            <p className="text-sm text-gray-600">
              Review the evidence submitted by each claimant.
              If their details match and you have physically
              returned the item, confirm the handover below.
            </p>

            {finderClaims.length === 0 && (
              <p className="text-sm text-gray-500">
                No ownership claims received yet.
              </p>
            )}

            {finderClaims.map((c) => (
              <div
                key={c._id}
                className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
              >

                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold text-ink">
                      👤 {c.claimant?.name || 'Claimant'}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Admin status: {c.status}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">
                    CLAIMANT'S OWNERSHIP DETAILS
                  </p>

                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {c.proof}
                  </p>
                </div>

                {c.photoUrl && (
                  <a
                    href={c.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-brand text-sm font-semibold underline"
                  >
                    📷 View ownership proof photo
                  </a>
                )}

                {c.finderDecision === 'Confirmed' ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="font-semibold text-green-800">
                      ✅ Handover confirmed
                    </p>

                    <p className="text-xs text-green-700 mt-1">
                      You confirmed that the ownership
                      details matched and the item was
                      handed over.
                      Admin status: {c.status}.
                    </p>
                  </div>
                ) : c.finderDecision === 'Disputed' ? (
                  <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                    You previously disputed this claim.
                  </p>
                ) : c.status === 'Pending' && item.status === 'Found' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Have you checked ${c.claimant?.name || 'the claimant'}'s ownership details AND physically handed over the item?\n\nOnly confirm after BOTH have happened.`
                      )

                      if (confirmed) {
                        decideOwnership(
                          c._id,
                          'Confirmed'
                        )
                      }
                    }}
                    className="w-full bg-green-700 hover:bg-green-800 text-white px-4 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {busy
                      ? 'Confirming...'
                      : "✅ Correct Ownership Details"}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    This claim is no longer available
                    for confirmation.
                  </p>
                )}
              </div>
            ))}

            {errorBox}
          </div>
        )}

        {/* Direct in-person return without an online claim */}
        {item.type === 'found' &&
          isOwner &&
          item.status === 'Found' && (
            <div className="mt-5 border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
              <h2 className="font-bold text-emerald-900">
                🤝 Returned directly in person?
              </h2>

              <p className="text-sm text-emerald-800">
                If the real owner collected the item without
                submitting an online claim, verify their
                ownership in person, then record the handover.
              </p>

              <button
                type="button"
                onClick={returnInPerson}
                disabled={busy}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg px-4 py-3 disabled:opacity-50"
              >
                {busy
                  ? 'Saving...'
                  : '✅ Mark as Returned in Person'}
              </button>

              {errorBox}
            </div>
          )}

        {item.type === 'found' &&
          isOwner &&
          item.status === 'Returned' &&
          item.resolutionMethod === 'in_person' && (
            <div className="mt-5 rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              ✅ Item returned directly to its owner in person.
            </div>
          )}

        {/* Existing LOST item finder contacts */}
        {finders.length > 0 && (
          <div className="mt-6 border-2 border-ink rounded-xl p-4 bg-gray-50">

            <p className="font-bold text-ink mb-3">
              🎉 Someone found this item
            </p>

            <div className="space-y-4">
              {finders.map((f) => (
                <div
                  key={f._id}
                  className="text-sm"
                >
                  <p>
                    <span className="text-gray-400">
                      Found by{' '}
                    </span>
                    <b>{f.finder?.name}</b>
                  </p>

                  <p>
                    <span className="text-gray-400">
                      Email{' '}
                    </span>
                    <a
                      href={`mailto:${f.finder?.email}`}
                      className="text-brand font-semibold hover:underline"
                    >
                      {f.finder?.email}
                    </a>
                  </p>

                  <p className="text-gray-600 mt-1">
                    "{f.message}"
                  </p>

                  {f.photoUrl && (
                    <a
                      href={f.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-1 text-brand font-semibold hover:underline"
                    >
                      View photo
                    </a>
                  )}
                </div>
              ))}
            </div>

            {isOwner && (
              <p className="text-xs text-gray-500 mt-3">
                Email them to arrange the handover,
                then press "I got it back" below.
              </p>
            )}
          </div>
        )}

        <div className="mt-6">
          {actions}
        </div>

        <Link
          to="/"
          className="inline-block mt-6 text-brand text-sm font-semibold hover:underline"
        >
          ← Back to browse
        </Link>
      </div>
    </div>
  )
}