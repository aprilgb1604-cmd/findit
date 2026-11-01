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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api.get('/claims/mine')
      .then((res) => setClaims(res.data))
      .catch(() => setError('Could not load your claims. Is the server running?'))
      .finally(() => setLoading(false))
  }, [user])

  if (authLoading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-ink mb-5">My Claims</h1>

      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : claims.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-gray-300 rounded-2xl py-16">
          <p className="text-4xl mb-2">📭</p>
          <p className="font-semibold">You haven't claimed anything yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Found your item?{' '}
            <Link to="/" className="text-brand font-semibold hover:underline">Browse items</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c._id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {c.item ? (
                    <Link to={`/items/${c.item._id}`} className="font-bold text-ink hover:text-brand">
                      {c.item.title}
                    </Link>
                  ) : (
                    <span className="font-bold text-gray-400">Item no longer available</span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.kind === 'found_report' ? 'Found report' : 'Claim'} sent on {new Date(c.createdAt).toLocaleDateString()}
                  </p>                  <p className="text-xs text-gray-400 mt-0.5">Claimed on {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${colors[c.status]}`}>
                  {c.status}
                </span>
              </div>
               <p className="text-sm text-gray-600 mt-3">
                <span className="text-gray-400">{c.kind === 'found_report' ? 'Your message: ' : 'Your proof: '}</span>{c.proof}
              </p>           </div>
          ))}
        </div>
      )}
    </div>
  )
}