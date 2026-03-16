'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Share, Plus, ArrowRight } from 'lucide-react'

type InstallState = 'checking' | 'installed' | 'installable' | 'ios' | 'unsupported'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  }, [])
  return isIOS
}

function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    )
  }, [])
  return isStandalone
}

export function WelcomeScreen() {
  const router = useRouter()
  const isIOS = useIsIOS()
  const isStandalone = useIsStandalone()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<InstallState>('checking')
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (isStandalone) {
      setInstallState('installed')
      return
    }

    // iOS — manual install instructions
    if (isIOS) {
      setInstallState('ios')
      return
    }

    // Listen for install prompt (Chromium browsers)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setInstallState('installable')
    }

    window.addEventListener('beforeinstallprompt', handler)

    // If no prompt fires after 2s, mark as unsupported
    const timeout = setTimeout(() => {
      setInstallState((prev) => (prev === 'checking' ? 'unsupported' : prev))
    }, 2000)

    window.addEventListener('appinstalled', () => {
      setInstallState('installed')
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timeout)
    }
  }, [isIOS, isStandalone])

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallState('installed')
    }
    setDeferredPrompt(null)
    setInstalling(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Logo */}
      <div className="mb-10">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="530 267 457 536" fill="none" className="h-16 w-16 mx-auto mb-6 drop-shadow-sm">
          <g fill="rgba(28,25,23,0.85)">
            <path d="M 695.0 783.5 L 573.5 783.0 L 573.5 404.0 L 549.5 374.0 L 695.0 286.5 L 695.0 783.5 Z"/>
            <path d="M 898.0 509.5 L 886.0 509.5 L 877.0 507.5 L 854.0 497.5 L 840.0 493.5 L 818.0 494.5 L 806.0 499.5 L 794.5 508.0 L 819.5 457.0 L 836.5 430.0 L 855.0 410.5 L 869.0 402.5 L 882.0 398.5 L 905.0 399.5 L 912.0 401.5 L 926.0 409.5 L 939.5 425.0 L 944.5 437.0 L 946.5 447.0 L 946.5 458.0 L 943.5 472.0 L 936.5 486.0 L 922.0 500.5 L 910.0 506.5 L 898.0 509.5 Z"/>
            <path d="M 967.0 783.5 L 828.0 783.5 L 726.5 653.0 L 723.5 649.0 L 723.5 646.0 L 778.0 539.5 L 954.5 765.0 L 967.5 782.0 L 967.0 783.5 Z"/>
          </g>
        </svg>
        <h1 className="text-3xl font-bold text-stone-800 tracking-tight">kosha</h1>
        <p className="text-stone-400 text-sm mt-2">AI-powered field sales</p>
      </div>

      {/* Value props */}
      <div className="space-y-3 mb-10 max-w-xs">
        {[
          'Capture visits with voice AI',
          'Plan optimized routes',
          'Surface high-leverage accounts',
        ].map((text) => (
          <div key={text} className="flex items-center gap-3 text-left">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <p className="text-sm text-stone-500">{text}</p>
          </div>
        ))}
      </div>

      {/* Install / Continue section */}
      <div className="w-full max-w-xs space-y-3">
        {/* Install button — Chromium browsers */}
        {installState === 'installable' && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {installing ? 'Installing...' : 'Install App'}
          </button>
        )}

        {/* iOS instructions */}
        {installState === 'ios' && !isStandalone && (
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-left space-y-3">
            <p className="text-xs font-medium text-stone-600">Install for the best experience</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <Share className="h-3.5 w-3.5 text-stone-500" />
                </div>
                <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">Share</span> in Safari</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <Plus className="h-3.5 w-3.5 text-stone-500" />
                </div>
                <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">Add to Home Screen</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Already installed badge */}
        {installState === 'installed' && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 text-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            App installed
          </div>
        )}

        {/* Continue to login */}
        <button
          onClick={() => router.push('/login')}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 active:scale-[0.98] transition-all"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-stone-400 mt-10">
        &copy; {new Date().getFullYear()} Kosha
      </p>
    </div>
  )
}
