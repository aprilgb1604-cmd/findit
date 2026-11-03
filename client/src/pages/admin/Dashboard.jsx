import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { categoryIcons } from '../../data/mockItems'

const statuses = ['Lost', 'Found', 'Claimed', 'Returned']
const HIDE_HOURS = 6 // keep in sync with HIDE_AFTER_HOURS on the server

const claimColors = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

// hours left before a Claimed/Returned item leaves the home page (0 = already gone)
const hoursLeft = (i) => {
  if (!['Claimed', 'Returned'].includes(i.status)) return null
  if (!i.resolvedAt) return 0
  const ms = new Date(i.resolvedAt).getTime() + HIDE_HOURS * 60 * 60 * 1000 - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / (60 * 60 * 1000))
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null) // item shown in the review window

  const isStaff = user && ['admin', 'staff'].includes(user.role)

  const load = async () => {
    try {
      const [i, c] = await Promise.all([api.get('/items/admin/all'), api.get('/claims')])
      setItems(i.data)
      setClaims(c.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load data. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isStaff) load()
  }, [isStaff])

  // close the review window with the Esc key
  useEffect(() => {
    if (!selected) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const act = async (request) => {
    try {
      await request()
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const verify = async (id) => {
    await act(() => api.patch(`/items/${id}/verify`))
    setSelected(null)
  }

  const reject = async (id) => {
    const reason = window.prompt('Reason for rejecting this report (optional):')
    if (reason === null) return
    await act(() => api.patch(`/items/${id}/reject`, { reason }))
    setSelected(null)
  }

  const hide = async (id) => {
    if (!window.confirm('Hide this item from the public? The reporter will be notified.')) return
    await act(() => api.patch(`/items/${id}/hide`))
    setSelected(null)
  }

  const setStatus = (id, status) => act(() => api.patch(`/items/${id}/status`, { status }))
  const review = (id, status) => act(() => api.patch(`/claims/${id}`, { status }))

  if (authLoading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (!isStaff) return <Navigate to="/login" replace />

  const count = (s) => items.filter((i) => i.status === s).length
  const awaiting = items.filter((i) => !i.verified && !i.rejected).length
  const pendingClaims = claims.filter((c) => c.status === 'Pending').length

  const cards = [
    ['Awaiting verification', awaiting, awaiting > 0],
    ['Pending claims', pendingClaims, pendingClaims > 0],
    ...statuses.map((s) => [s, count(s), false]),
  ]

  const tabClass = (t) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition ${
      tab === t ? 'bg-ink text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-ink'
    }`

  const visibilityCell = (i) => {
    if (i.verified && i.hidden) {
      return (
        <button onClick={() => setSelected(i)} className="text-xs font-bold text-gray-500 hover:text-brand hover:underline" title="Hidden by an admin. Click to show it again.">
          Hidden
        </button>
      )
    }
    if (i.verified) {
      const left = hoursLeft(i)
      if (left === 0) {
        return (
          <span className="text-xs font-bold text-gray-500" title="Off the home page. Set the status back to Lost or Found to show it again.">
            Archived
          </span>
        )
      }
      if (left) {
        return <span className="text-xs font-bold text-emerald-700">Public · hides in ~{left}h</span>
      }
      return <span className="text-xs font-bold text-emerald-700">Public</span>
    }
    if (i.rejected) {
      return (
        <button onClick={() => setSelected(i)} className="text-xs font-bold text-red-600 hover:underline">
          Rejected
        </button>
      )
    }
    return (
      <button onClick={() => setSelected(i)} className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-dark active:scale-95 transition">
        Review
      </button>
    )
  }

  const waiting = selected && !selected.verified && !selected.rejected
  const isPublic = selected && selected.verified && !selected.hidden
  const isHidden = selected && selected.verified && selected.hidden

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink mb-5">Admin Dashboard</h1>

      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {cards.map(([label, n, alert]) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${alert ? 'bg-brand-light border-brand' : 'bg-white border-gray-200'}`}>
            <p className="text-3xl font-extrabold text-brand">{n}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('items')} className={tabClass('items')}>Items ({items.length})</button>
        <button onClick={() => setTab('claims')} className={tabClass('claims')}>Claims ({claims.length})</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : tab === 'items' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Type</th>
                <th className="p-3">Reported by</th>
                <th className="p-3">Date</th>
                <th className="p-3">Visibility</th>
                <th className="p-3">Status</th>
                <th className="p-3">Update status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">No items reported yet.</td></tr>
              )}
              {items.map((i) => (
                <tr key={i._id} className="border-t border-gray-200">
                  <td className="p-3">
                    <button onClick={() => setSelected(i)} className="flex items-center gap-3 text-left group">
                      <span className="w-10 h-10 rounded-lg bg-gray-100 grid place-items-center text-xl overflow-hidden shrink-0">
                        {i.photoUrl ? (
                          <img src={i.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          categoryIcons[i.category] || '📦'
                        )}
                      </span>
                      <span className="font-semibold group-hover:text-brand group-hover:underline">{i.title}</span>
                    </button>
                  </td>
                  <td className="p-3 capitalize">{i.type}</td>
                  <td className="p-3">
                    {i.reportedBy?.name || 'Unknown'}
                    {i.reportedBy?.email && <span className="block text-xs text-gray-400">{i.reportedBy.email}</span>}
                  </td>
                  <td className="p-3">{i.date}</td>
                  <td className="p-3">{visibilityCell(i)}</td>
                  <td className="p-3"><StatusBadge status={i.status} /></td>
                  <td className="p-3">
                    <select value={i.status} onChange={(e) => setStatus(i._id, e.target.value)} className="border border-gray-300 rounded px-2 py-1">
                      {statuses.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Submitted by</th>
                <th className="p-3">Proof / message</th>
                <th className="p-3">Finder check</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">No claims yet.</td></tr>
              )}
              {claims.map((c) => (
                <tr key={c._id} className="border-t border-gray-200">
                  <td className="p-3 font-semibold">
                    {c.item?.title || 'Deleted item'}
                    <span className={`block text-xs font-bold ${c.kind === 'found_report' ? 'text-brand' : 'text-gray-400'}`}>
                      {c.kind === 'found_report' ? 'FOUND REPORT' : 'OWNER CLAIM'}
                    </span>
                    {c.item?.reportedBy?.name && (
                      <span className="block text-xs font-normal text-gray-500">
                        Item reported by: {c.item.reportedBy.name}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {c.claimant?.name}
                    <span className="block text-xs text-gray-400">{c.claimant?.email}</span>
                  </td>
                  <td className="p-3 max-w-xs">
                    {c.proof}
                    {c.photoUrl && (
                      <a href={c.photoUrl} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-brand hover:underline mt-1">
                        View photo
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-xs font-semibold">
                    {c.kind === 'found_report' ? 'Not applicable' : (c.finderDecision || 'Pending')}
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${claimColors[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="p-3">
                    {c.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <button disabled={c.kind === 'claim' && c.finderDecision !== 'Confirmed'} title={c.kind === 'claim' && c.finderDecision !== 'Confirmed' ? 'Finder confirmation required' : 'Approve'} onClick={() => review(c._id, 'Approved')} className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          Approve
                        </button>
                        <button onClick={() => review(c._id, 'Rejected')} className="bg-white border border-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:border-brand hover:text-brand active:scale-95 transition">
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review window */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-72 bg-gray-100 grid place-items-center text-7xl rounded-t-2xl overflow-hidden">
              {selected.photoUrl ? (
                <img src={selected.photoUrl} alt={selected.title} className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-center">
                  <div>{categoryIcons[selected.category] || '📦'}</div>
                  <p className="text-sm text-gray-400 mt-2">No photo added</p>
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-ink font-bold hover:bg-white active:scale-95 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold text-ink">{selected.title}</h2>
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-gray-600 mt-2 text-sm">{selected.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div><span className="text-gray-400">Type</span><p className="font-semibold capitalize">{selected.type}</p></div>
                <div><span className="text-gray-400">Category</span><p className="font-semibold">{selected.category}</p></div>
                <div><span className="text-gray-400">Location</span><p className="font-semibold">{selected.location}</p></div>
                <div><span className="text-gray-400">Date</span><p className="font-semibold">{selected.date}</p></div>
                <div className="col-span-2">
                  <span className="text-gray-400">Reported by</span>
                  <p className="font-semibold">
                    {selected.reportedBy?.name || 'Unknown'}
                    <span className="font-normal text-gray-500"> · {selected.reportedBy?.email}</span>
                  </p>
                </div>
              </div>

              {waiting && (
                <div className="flex gap-3 mt-6">
                  <button onClick={() => verify(selected._id)} className="flex-1 bg-ink text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-600 active:scale-95 transition">
                    ✓ Verify
                  </button>
                  <button onClick={() => reject(selected._id)} className="flex-1 bg-white border border-gray-300 font-semibold py-2.5 rounded-lg hover:border-brand hover:text-brand active:scale-95 transition">
                    ✕ Reject
                  </button>
                </div>
              )}

              {isPublic && (
                <div className="mt-6">
                  <button onClick={() => hide(selected._id)} className="w-full bg-white border border-gray-300 font-semibold py-2.5 rounded-lg hover:border-brand hover:text-brand active:scale-95 transition">
                    Hide from public
                  </button>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Claimed and Returned items leave the home page automatically after {HIDE_HOURS} hours.
                  </p>
                </div>
              )}

              {isHidden && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-3">This item was hidden by an admin and is not on the home page.</p>
                  <button onClick={() => verify(selected._id)} className="w-full bg-ink text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-600 active:scale-95 transition">
                    Show on public page
                  </button>
                </div>
              )}

              {selected.rejected && !selected.verified && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-3">This report was rejected.</p>
                  <button onClick={() => verify(selected._id)} className="w-full bg-ink text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-600 active:scale-95 transition">
                    ✓ Verify anyway
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}