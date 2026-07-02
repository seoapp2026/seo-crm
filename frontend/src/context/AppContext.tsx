import { createContext, useContext, useState, type ReactNode } from 'react'

interface AppContextValue {
  scopeProject: number | 'all'
  setScopeProject: (v: number | 'all') => void
  crumb: string
  setCrumb: (v: string) => void
  crumbSub: string
  setCrumbSub: (v: string) => void
  topbarAction: ReactNode
  setTopbarAction: (v: ReactNode) => void
  toast: (msg: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [scopeProject, setScopeProject] = useState<number | 'all'>('all')
  const [crumb, setCrumb] = useState('dashboard')
  const [crumbSub, setCrumbSub] = useState('')
  const [topbarAction, setTopbarAction] = useState<ReactNode>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const toast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2600)
  }

  return (
    <AppContext.Provider
      value={{
        scopeProject,
        setScopeProject,
        crumb,
        setCrumb,
        crumbSub,
        setCrumbSub,
        topbarAction,
        setTopbarAction,
        toast,
      }}
    >
      {children}
      <div className={`toast ${toastVisible ? 'show' : 'hide'}`}>{toastMsg}</div>
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}