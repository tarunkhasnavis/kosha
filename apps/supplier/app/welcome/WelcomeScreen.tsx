'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Share, Plus, ArrowRight, ChevronDown, SquarePlus, Ellipsis } from 'lucide-react'

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

function useIsSafari() {
  const [isSafari, setIsSafari] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    // Safari but not Chrome/CriOS/Firefox/Edge
    setIsSafari(/Safari/.test(ua) && !/CriOS|Chrome|FxiOS|EdgiOS/.test(ua))
  }, [])
  return isSafari
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
  const isSafari = useIsSafari()
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
        <img src="/icons/kosha-k.svg" alt="Kosha" className="h-16 w-16 mx-auto mb-6 drop-shadow-sm" style={{ filter: 'brightness(0) opacity(0.85)' }} />
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
            {isSafari ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Ellipsis className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">•••</span> (bottom right)</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Share className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">Share</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <ChevronDown className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">View more</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <SquarePlus className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">Add to Home Screen</span></p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Share className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap the <span className="text-stone-800 font-medium">Share</span> icon (top right)</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <ChevronDown className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">View more</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <SquarePlus className="h-3.5 w-3.5 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-400">Tap <span className="text-stone-800 font-medium">Add to Home Screen</span></p>
                </div>
              </div>
            )}
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
      <p className="absolute bottom-6 text-[10px] text-stone-400">
        &copy; {new Date().getFullYear()} Kosha
      </p>
    </div>
  )
}
