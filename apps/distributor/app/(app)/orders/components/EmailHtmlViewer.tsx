"use client"

import { useRef, useEffect, useState } from "react"

interface EmailHtmlViewerProps {
  html: string
}

/**
 * Renders email HTML in a sandboxed iframe to isolate email styles
 * from the app's CSS. This ensures the email looks as it does in Gmail.
 */
export function EmailHtmlViewer({ html }: EmailHtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(384) // default max-h-96 equivalent

  // Build the full HTML document for the iframe
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_blank" />
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #334155;
            overflow-x: hidden;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          table {
            max-width: 100%;
          }
          a {
            color: #2563eb;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const adjustHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc?.body) {
          const contentHeight = doc.body.scrollHeight
          setHeight(Math.min(contentHeight + 16, 800))
        }
      } catch {
        // Cross-origin restrictions - keep default height
      }
    }

    iframe.addEventListener('load', adjustHeight)
    return () => iframe.removeEventListener('load', adjustHeight)
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="w-full border-0 rounded-lg bg-white"
      style={{ height: `${height}px` }}
      title="Original email"
    />
  )
}
