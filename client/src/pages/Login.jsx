import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(['admin', 'staff'].includes(user.role) ? '/admin' : '/')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'border border-gray-300 bg-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-ink focus:ring-2 focus:ring-gray-200'

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white border border-gray-200 rounded-2xl p-7 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-ink">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Log in to report items and track your claims.</p>
      </div>
      <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2">{error}</p>}
      <button disabled={busy} className="w-full bg-ink text-white py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50">
        {busy ? 'Logging in...' : 'Login'}
      </button>
      <p className="text-sm text-center text-gray-500">
        No account? <Link to="/register" className="text-brand font-semibold hover:underline">Sign up</Link>
      </p>
    </form>
  )
}