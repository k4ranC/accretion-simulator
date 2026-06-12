import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AccretionPage from './pages/AccretionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/accretion" element={<AccretionPage />} />
      </Routes>
    </BrowserRouter>
  )
}