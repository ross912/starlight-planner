import { Routes, Route } from 'react-router'
import { lazy, Suspense } from 'react'
import AuthGate from './components/AuthGate'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import DiaryPage from './pages/Diary'
import PlansPage from './pages/Plans'
import MoneyPage from './pages/Money'
import ReadingPage from './pages/Reading'
import FitnessPage from './pages/Fitness'
import SummaryPage from './pages/Summary'
import AiChatPage from './pages/AiChat'
import StatsPage from './pages/Stats'

// PDF 阅读器较大（pdf.js），按需懒加载
const PdfReaderPage = lazy(() => import('./pages/PdfReader'))

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/money" element={<MoneyPage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/reading/:bookId/reader" element={<Suspense fallback={<p className="py-20 text-center text-sm text-stone-400">阅读器加载中…</p>}><PdfReaderPage /></Suspense>} />
          <Route path="/fitness" element={<FitnessPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/summary/chat" element={<AiChatPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Routes>
    </AuthGate>
  )
}
