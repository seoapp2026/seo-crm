import { useEffect } from 'react'
import { APP } from '../constants'

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP.name}` : APP.name
  }, [pageTitle])
}