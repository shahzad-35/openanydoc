import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ViewerPlaceholderPage from './pages/ViewerPlaceholderPage'
import { viewers } from './viewers'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        {viewers.map((viewer) => (
          <Route
            key={viewer.path}
            path={viewer.path}
            element={<ViewerPlaceholderPage viewerLabel={viewer.label} />}
          />
        ))}
      </Route>
    </Routes>
  )
}
