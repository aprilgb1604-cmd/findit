import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { categoryIcons } from '../data/mockItems'

export default function ItemCard({ item }) {
  return (
    <Link
      to={`/items/${item._id}`}
      className="group bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col hover:border-ink hover:-translate-y-1 hover:shadow-xl transition duration-200"
    >
      <div className="relative h-56 bg-gray-100 grid place-items-center text-5xl group-hover:bg-brand-light transition overflow-hidden">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.title} className="w-full h-full object-contain" />        ) : (
          <span className="group-hover:scale-110 transition duration-200">
            {categoryIcons[item.category] || '📦'}
          </span>
        )}
        <span
          className={`absolute top-3 left-3 text-[11px] font-bold tracking-wider px-2 py-1 rounded ${
            item.type === 'lost' ? 'bg-brand text-white' : 'bg-ink text-white'
          }`}
        >
          {item.type.toUpperCase()}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-ink leading-snug">{item.title}</h3>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-500">
          <span>📍 {item.location}</span>
          <span>{item.date}</span>
        </div>
        <span className="mt-3 text-sm font-semibold text-brand group-hover:underline">
          View details →
        </span>
      </div>
    </Link>
  )
}