import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isPublicPath } from './utils/weddingPublication'

const directory = document.getElementById('public-wedding-directory')
if (directory) directory.hidden = !isPublicPath(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
