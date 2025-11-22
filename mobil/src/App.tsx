import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Products from './pages/Products'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Hesablar from './pages/Hesablar'
import Anbar from './pages/Anbar'
import AlisQaimeleri from './pages/Qaimeler/Alis'
import SatisQaimeleri from './pages/Qaimeler/Satisqaime'
import KassaMedaxil from './pages/Kassa/Medaxil'
import KassaMexaric from './pages/Kassa/Mexaric'
import Alicilar from './pages/Musteriler/Alici'
import Saticilar from './pages/Musteriler/Satici'
import DebugLogs from './pages/DebugLogs'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'

const basename = import.meta.env.DEV ? '/' : '/mobil'

function App() {
  return (
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hesablar"
          element={
            <ProtectedRoute>
              <Hesablar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/anbar"
          element={
            <ProtectedRoute>
              <Anbar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qaimeler/alis"
          element={
            <ProtectedRoute>
              <AlisQaimeleri />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qaimeler/satis"
          element={
            <ProtectedRoute>
              <SatisQaimeleri />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kassa/medaxil"
          element={
            <ProtectedRoute>
              <KassaMedaxil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kassa/mexaric"
          element={
            <ProtectedRoute>
              <KassaMexaric />
            </ProtectedRoute>
          }
        />
        <Route
          path="/musteriler/alici"
          element={
            <ProtectedRoute>
              <Alicilar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/musteriler/satici"
          element={
            <ProtectedRoute>
              <Saticilar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        {/* Debug log pəncərəsi – yalnız admin/debug üçün, amma auth tələb olunur */}
        <Route
          path="/debug-logs"
          element={
            <ProtectedRoute>
              <DebugLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <Admin />
            </ProtectedRoute>
          }
        />
        {/* Uyğun gəlməyən bütün path-ləri ana səhifəyə yönləndir */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

