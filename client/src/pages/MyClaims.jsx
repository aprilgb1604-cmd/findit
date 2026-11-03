
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const colors = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

export default function MyClaims() {
  const { user, loading: authLoading } = useAuth()

  const [claims, setClaims] = useState([])
  const [finderContacts, setFinderContacts] = useState({})
  const [contactErrors, setContactErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadClaims = async () => {
      try {
        const res = await api.get('/claims/mine')

        if (cancelled) return

        const myClaims = res.data
        setClaims(myClaims)
        setError('')

        // Only request contact information for approved
        // ownership claims on Found items.
        const approvedClaims = myClaims.filter(
          (c) =>
            c.kind === 'claim' &&
            c.status === 'Approved' &&
            c.item
        )

        const results = await Promise.allSettled(
          approvedClaims.map((c) =>
            api.get(`/claims/approved-finder/${c._id}`)
          )
        )

        if (cancelled) return

        const contacts = {}
        const errors = {}

        results.forEach((result, index) => {
          const claimId = approvedClaims[index]._id

          if (result.status === 'fulfilled') {
            contacts[claimId] = result.value.data.finder
          } else {
            errors[claimId] =
              result.reason?.response?.data?.message ||
              'Contact details could not be loaded.'
          }
        })

        setFinderContacts(contacts)
        setContactErrors(errors)
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
            'Could not load your claims. Is the server running?'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadClaims()

    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading) {
    return (
      <div className="text-center text-gray-400 py-16">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="max-w-2xl mx-auto">

      <h1 className="text-2xl font-extrabold text-ink mb-5">
        My Claims
      </h1>

      {error && (
        <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-16">
          Loading...
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-gray-300 rounded-2xl py-16">

          <p className="text-4xl mb-2">📭</p>

          <p className="font-semibold">
            You haven't claimed anything yet.
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Found your item?{' '}
            <Link
              to="/"
              className="text-brand font-semibold hover:underline"
            >
              Browse items
            </Link>
          </p>

        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => {
            const isOwnershipClaim = c.kind === 'claim'

            const isApprovedOwnershipClaim =
              isOwnershipClaim &&
              c.status === 'Approved'

            const finder = finderContacts[c._id]

            return (
              <div
                key={c._id}
                className="bg-white border border-gray-200 rounded-2xl p-4"
              >

                {/* Item title and claim status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {c.item ? (
                      <Link
                        to={`/items/${c.item._id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {c.item.title}
                      </Link>
                    ) : (
                      <span className="font-bold text-gray-400">
                        Item no longer available
                      </span>
                    )}

                    <p className="text-xs text-gray-400 mt-0.5">
                      {isOwnershipClaim
                        ? 'Claim'
                        : 'Found report'}{' '}
                      sent on{' '}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      colors[c.status] || ''
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Original proof/message */}
                <p className="text-sm text-gray-600 mt-3">
                  <span className="text-gray-400">
                    {isOwnershipClaim
                      ? 'Your proof: '
                      : 'Your message: '}
                  </span>
                  {c.proof}
                </p>

                {/* Original finder verification status */}
                {isOwnershipClaim && c.status === 'Pending' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Finder check: {c.finderDecision || 'Pending'}
                    {' · '}
                    Admin decision pending
                  </p>
                )}

                {/* Pending ownership claim */}
                {isOwnershipClaim && c.status === 'Pending' && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⏳ Your claim is under review.
                      Finder contact information will be available
                      only after final admin approval.
                    </p>
                  </div>
                )}

                {/* Rejected ownership claim */}
                {isOwnershipClaim && c.status === 'Rejected' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">
                      Your claim was not approved.
                      Finder contact information is unavailable.
                    </p>
                  </div>
                )}

                {/* NEW: approved owner gets finder contact */}
                {isApprovedOwnershipClaim && (
                  <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">

                    <div>
                      <p className="font-bold text-emerald-800">
                        ✅ Claim Approved!
                      </p>
                      <p className="text-sm text-emerald-700 mt-1">
                        Your ownership claim has been approved
                        by the admin.
                      </p>
                    </div>

                    {finder ? (
                      <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">

                        <p className="font-semibold text-ink text-sm">
                          📦 Finder Contact Details
                        </p>

                        <p className="text-sm text-gray-700">
                          <span className="text-gray-500">
                            Name:{' '}
                          </span>
                          <span className="font-semibold">
                            {finder.name}
                          </span>
                        </p>

                        <p className="text-sm text-gray-700 break-all">
                          <span className="text-gray-500">
                            Email:{' '}
                          </span>
                          <a
                            href={`mailto:${finder.email}`}
                            className="text-brand font-semibold hover:underline"
                          >
                            {finder.email}
                          </a>
                        </p>

                        <a
                          href={`mailto:${finder.email}?subject=${encodeURIComponent(
                            `FindIt - Approved claim for ${c.item?.title || 'my item'}`
                          )}`}
                          className="inline-block bg-ink text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand transition"
                        >
                          ✉️ Email Finder
                        </a>

                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {contactErrors[c._id] ||
                          'Loading finder contact information...'}
                      </p>
                    )}

                    <p className="text-xs text-gray-600">
                      Contact the finder to arrange a safe handover.
                      Approval does not mean the item has
                      already been returned.
                    </p>

                  </div>
                )}

                {/* Existing Lost-item found report */}
                {!isOwnershipClaim && c.status === 'Approved' && (
                  <p className="text-sm text-emerald-700 mt-3">
                    ✅ Your found report was approved.
                    The owner can contact you.
                  </p>
                )}

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
