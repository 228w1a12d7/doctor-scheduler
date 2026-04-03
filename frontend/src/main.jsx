import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { MockApiProvider } from './context/MockApiContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MockApiProvider>
        <App />
      </MockApiProvider>
    </BrowserRouter>
  </StrictMode>,
)
