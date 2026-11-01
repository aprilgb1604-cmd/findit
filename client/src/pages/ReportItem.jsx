import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { categories, locations } from '../data/mockItems'

export default function ReportItem() {
  const { user, loading } = useAuth()
  const [type, setType] = useState('lost')
  const [form, setForm] = useState({ title: '', category: '', location: '', date: '', description: '' })
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onPhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB')
      e.target.value = ''
      return
    }
    setError('')
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = new FormData()
      Object.entries(form).forEach(([key, value]) => data.append(key, value))
      data.append('type', type)
      if (photo) data.append('photo', photo)
      await api.post('/items', data)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit the report')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'border border-gray-300 bg-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-ink focus:ring-2 focus:ring-gray-200'

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-4xl mb-2">🔒</p>
        <p className="font-bold text-ink">Please log in to report an item</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">This lets us notify you when someone claims it.</p>
        <Link to="/login" className="bg-ink text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand transition">Login</Link>
      </div>
    )
  }

  if (submitted) {
    const trusted = ['admin', 'staff'].includes(user.role)
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-4xl mb-2">✅</p>
        <p className="font-bold text-ink">Your {type} item report was submitted!</p>
        <p className="text-sm text-gray-500 mt-1">
          {trusted ? 'It is already public.' : 'An admin will verify it before it appears publicly.'}
        </p>
        <Link to="/" className="inline-block mt-5 text-brand font-semibold hover:underline">Back to browse</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h1 className="text-2xl font-extrabold text-ink">Report an Item</h1>

      <div className="grid grid-cols-2 gap-2">
        {['lost', 'found'].map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`py-2.5 rounded-lg font-semibold transition ${
              type === t ? (t === 'lost' ? 'bg-brand text-white' : 'bg-ink text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            I {t === 'lost' ? 'lost' : 'found'} something
          </button>
        ))}
      </div>

      <input required name="title" value={form.title} onChange={change} placeholder="Item name (e.g. Black Wallet)" className={inputClass} />

      <div className="grid grid-cols-2 gap-3">
        <select required name="category" value={form.category} onChange={change} className={inputClass}>
          <option value="">Category</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select required name="location" value={form.location} onChange={change} className={inputClass}>
          <option value="">Location</option>
          {locations.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      <input required type="date" name="date" value={form.date} onChange={change} className={inputClass} />
      <textarea required rows={3} name="description" value={form.description} onChange={change} placeholder="Describe the item (color, brand, marks...)" className={inputClass} />

      <div>
        <label className="block text-sm text-gray-600 mb-2">Photo (optional, max 5 MB)</label>
        <input id="photo" type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        <label
          htmlFor="photo"
          className="inline-flex items-center gap-2 cursor-pointer bg-ink text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand active:scale-95 transition"
        >
          📷 {photo ? 'Change photo' : 'Add photo'}
        </label>
        {photo && <span className="ml-3 text-sm text-gray-500">{photo.name}</span>}
        {preview && <img src={preview} alt="preview" className="mt-3 h-32 rounded-lg object-contain bg-gray-100" />}
      </div>

      {error && <p className="text-sm text-brand bg-brand-light rounded-lg px-3 py-2">{error}</p>}

      <button disabled={busy} className="w-full bg-ink text-white py-2.5 rounded-lg font-semibold hover:bg-brand active:scale-95 transition disabled:opacity-50">
        {busy ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  )
}