import { Suspense } from 'react'
import Checker from './components/Checker.jsx'

export default function App() {
  return (
    <Suspense fallback={<p className="loading">Checking the fare matrix…</p>}>
      <Checker />
    </Suspense>
  )
}
