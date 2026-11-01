const styles = {
  Lost: 'bg-red-100 text-red-700',
  Found: 'bg-gray-900 text-white',
  Claimed: 'bg-amber-100 text-amber-800',
  Returned: 'bg-emerald-100 text-emerald-700',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}