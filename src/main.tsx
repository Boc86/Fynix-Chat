import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { initializeDatabase } from '@/lib/storage'

const root = document.getElementById('root')!

// Show loading state immediately
root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0a0a0a;color:#ececec;font-family:Inter,sans-serif;flex-direction:column;gap:12px">
  <div style="width:24px;height:24px;border:3px solid #2a2a2a;border-top-color:#10a37f;border-radius:50%;animation:spin 1s linear infinite"></div>
  <div style="font-size:14px;color:#666">Loading Fynix Chat...</div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</div>`

initializeDatabase().catch(() => {
  // DB init failed - app still renders, data features degrade gracefully
}).finally(() => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})