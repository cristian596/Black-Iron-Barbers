import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource/bebas-neue';
import {RouterProvider } from 'react-router-dom'
import AppRouter from './routes/AppRouter'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={AppRouter} />
    </AuthProvider>
  </StrictMode>,
)
