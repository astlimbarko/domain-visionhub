import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'
import './utils/i18n'
import App from './App.tsx'
import { AppearanceProvider } from './preview-ui/AppearanceProvider'
import './preview-ui/appearance.css'
import './preview-ui/leader-landing.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppearanceProvider><App /></AppearanceProvider>
  </StrictMode>,
)
