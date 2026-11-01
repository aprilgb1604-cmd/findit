import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import ItemDetails from './pages/ItemDetails'
import ReportItem from './pages/ReportItem'
import Login from './pages/Login'
import Register from './pages/Register'
import MyClaims from './pages/MyClaims'
import Notifications from './pages/Notifications'
import Dashboard from './pages/admin/Dashboard'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/items/:id" element={<ItemDetails />} />
          <Route path="/report" element={<ReportItem />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-claims" element={<MyClaims />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  )
}