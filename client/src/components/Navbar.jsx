import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  // keep the bell count fresh
  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    const fetchCount = () =>
      api.get('/notifications')
        .then((res) => setUnread(res.data.filter((n) => !n.read).length))
        .catch(() => {})

    fetchCount()
    const timer = setInterval(fetchCount, 30000)
    window.addEventListener('notifications-updated', fetchCount)
    return () => {
      clearInterval(timer)
      window.removeEventListener('notifications-updated', fetchCount)
    }
  }, [user, routeLocation.pathname])

  const links = [
    { to: '/', label: 'Browse', end: true },
    { to: '/report', label: 'Report Item' },
    ...(user ? [{ to: '/my-claims', label: 'My Claims' }] : []),
    ...(user && ['admin', 'staff'].includes(user.role) ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  const linkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-semibold border-b-2 transition ${
      isActive ? 'border-brand text-ink' : 'border-transparent text-gray-500 hover:text-ink'
    }`

  const doLogout = () => {
    logout()
    setOpen(false)
    navigate('/')
  }

  const Bell = ({ onClick }) => (
    <Link to="/notifications" onClick={onClick} className="relative w-10 h-10 grid place-items-center rounded-lg hover:bg-gray-100 transition" aria-label="Notifications">
      <span className="text-xl">🔔</span>
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-bold grid place-items-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="bg-ink text-white w-8 h-8 rounded-lg grid place-items-center text-base">F</span>
          <span>Find<span className="text-brand">It</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Bell />
              <span className="text-sm text-gray-600">Hi, <b className="text-ink">{user.name.split(' ')[0]}</b></span>
              <button onClick={doLogout} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand active:scale-95 transition">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-ink">Login</Link>
              <Link to="/register" className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand active:scale-95 transition">
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-1">
          {user && <Bell />}
          <button onClick={() => setOpen(!open)} className="text-2xl w-10 h-10" aria-label="Menu">
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)} className="py-2 font-semibold">
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <button onClick={doLogout} className="bg-ink text-white font-semibold py-2 rounded-lg mt-1">
              Logout ({user.name.split(' ')[0]})
            </button>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="py-2 font-semibold">Login</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="bg-ink text-white text-center font-semibold py-2 rounded-lg mt-1">
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}