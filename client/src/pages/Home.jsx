import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import api from '../api/axios'
import { categories, locations, categoryIcons } from '../data/mockItems'

export default function Home() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ Lost: 0, Found: 0, Claimed: 0, Returned: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('')

  // stat numbers (loaded once)
  useEffect(() => {
    api.get('/items/stats').then((res) => setStats(res.data)).catch(() => {})
  }, [])

  // items (reloads whenever a filter changes; waits 300ms while typing)
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      api
        .get('/items', { params: { search, category, location, type, date } })
        .then((res) => {
          setItems(res.data)
          setError('')
        })
        .catch(() => setError('Could not load items. Is the server running?'))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category, location, type, date])

  const hasFilters = search || category || location || date || type
  const clearAll = () => {
    setSearch('')
    setCategory('')
    setLocation('')
    setDate('')
    setType('')
  }

  const inputClass =
    'border border-gray-300 bg-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-ink focus:ring-2 focus:ring-gray-200'

  return (
    <div>
      {/* Hero */}
      <section className="bg-ink text-white rounded-3xl p-8 md:p-14 mb-8">
        <p className="text-brand font-bold text-sm tracking-widest mb-3">CAMPUS LOST &amp; FOUND</p>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight max-w-2xl">
          Lost something on campus? <span className="text-brand">Let's find it.</span>
        </h1>
        <p className="text-gray-400 mt-4 max-w-xl">
          Report a lost or found item in under a minute, search what others have posted, and claim what's yours.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link to="/report" className="bg-brand hover:bg-brand-dark active:scale-95 transition px-6 py-3 rounded-xl font-bold">
            I lost something
          </Link>
          <Link to="/report" className="bg-white text-ink hover:bg-gray-200 active:scale-95 transition px-6 py-3 rounded-xl font-bold">
            I found something
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-white/15">
          {['Lost', 'Found', 'Claimed', 'Returned'].map((s) => (
            <div key={s}>
              <p className="text-3xl font-extrabold">{stats[s] ?? 0}</p>
              <p className="text-sm text-gray-400">{s} items</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button
          onClick={() => setCategory('')}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition active:scale-95 ${
            !category ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-300 hover:border-ink'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c === category ? '' : c)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition active:scale-95 ${
              category === c ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-300 hover:border-ink'
            }`}
          >
            {categoryIcons[c]} {c}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 grid gap-3 md:grid-cols-4">
        <input className={inputClass} placeholder="🔎 Search item name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
          {[['', 'All'], ['lost', 'Lost'], ['found', 'Found']].map(([val, label]) => (
            <button
              key={label}
              onClick={() => setType(val)}
              className={`py-1.5 rounded-md text-sm font-semibold transition ${
                type === val ? 'bg-white shadow text-ink' : 'text-gray-500 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500"><b className="text-ink">{items.length}</b> item(s) found</p>
        {hasFilters && (
          <button onClick={clearAll} className="text-sm font-semibold text-brand hover:underline">
            Clear filters ✕
          </button>
        )}
      </div>

      {error ? (
        <div className="text-center bg-brand-light text-brand rounded-2xl py-10 font-semibold">{error}</div>
      ) : loading ? (
        <div className="text-center text-gray-400 py-16">Loading items...</div>
      ) : items.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-gray-300 rounded-2xl py-16">
          <p className="text-4xl mb-2">🕵️</p>
          <p className="font-semibold">No items match your search.</p>
          <p className="text-sm text-gray-500 mt-1">Try removing a filter, or report the item yourself.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <ItemCard key={item._id} item={item} />)}
        </div>
      )}
    </div>
  )
}