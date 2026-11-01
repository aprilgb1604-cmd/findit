import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function Notifications() {
  const { user, loading: authLoading } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    api.get('/notifications')
      .then(async (res) => {
        if (cancelled) return
        setList(res.data) // keeps the "new" highlight for this visit

        // opening the page counts as reading everything
        if (res.data.some((n) => !n.read)) {
          try {
            await api.patch('/notifications/read-all')
            window.dispatchEvent(new Event('notifications-updated')) // clears the bell number
          } catch {
            /* not critical */
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load notifications. Is the server running?')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  const fresh = list.filter((n) => !n.read).length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-extrabold text-ink">Notifications</h1>
        {fresh > 0 && <span className="text-sm font-semibold text-brand">{fresh} new</span>}
      </div>

      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : list.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-gray-300 rounded-2xl py-16">
          <p className="text-4xl mb-2">🔔</p>
          <p className="font-semibold">No notifications yet.</p>
          <p className="text-sm text-gray-500 mt-1">You'll see updates about your reports and claims here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-200 overflow-hidden">
          {list.map((n) => (
            <div key={n._id} className={`flex gap-3 p-4 ${n.read ? '' : 'bg-brand-light'}`}>
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-brand'}`} />
              <div>
                <p className={`text-sm ${n.read ? 'text-gray-600' : 'text-ink font-semibold'}`}>{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}