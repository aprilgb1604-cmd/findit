import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form.name, form.email, form.password)
      navigate('/')
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
        <h1 className="text-2xl font-extrabold text-ink">Create your account</h1>
        <p className="text-sm text-gray-500 mt-1">It takes less than a minute.</p>
      </div>
      <input required name="name" placeholder="Full name" value={form.name} onChange={change} className={inputClass} />
      <input required type="email" name="email" placeholder="Email" value={form.email} onChange={change} className={inputClass} />
      <input required type="password" minLength={6} name="password" placeholder="Password (min 6 characters)" value={form.password} onChange={change} className={inputClass} />
      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2">{error}</p>}
      <button disabled={busy} className="w-full bg-ink text-white py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50">
        {busy ? 'Creating account...' : 'Sign Up'}
      </button>
      <p className="text-sm text-center text-gray-500">
        Already have an account? <Link to="/login" className="text-brand font-semibold hover:underline">Login</Link>
      </p>
    </form>
  )
}