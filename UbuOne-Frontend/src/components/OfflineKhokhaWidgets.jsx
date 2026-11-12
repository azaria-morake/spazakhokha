/**
 * Offline counter payment and Open Payments batch settlement UI components.
 * Supports merchant-initiated Request QRs, customer ECDSA payment passes,
 * contrast-boosted camera scanning, and optional voice readout accessibility.
 */
﻿import React, { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImageUp, Loader2, QrCode, RefreshCw, ShieldCheck, Volume2, VolumeX, WifiOff, X } from 'lucide-react'
import { Badge, Button, Input } from './ui/primitives'
import {
  decodeQrFromImageData,
  encodeCompactOfflineQr,
  generateQrDataUrl,
  getCachedIssuerPub,
  getMerchantOfflineQueue,
  getSavedAllowance,
  mintOfflineAllowance,
  settleOfflineQueueBatch,
  signOfflinePaymentNote,
  syncIssuerPublicKey,
  verifyAndQueueOfflinePackage,
} from '../lib/offlineCrypto'

let sharedAudioCtx = null

function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx()
      if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume()
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  } catch {}
}

function isVoiceEnabled() {
  try {
    return localStorage.getItem('spazakhokha_voice_enabled') === 'true'
  } catch {
    return false
  }
}

function setVoiceEnabledPref(enabled) {
  try {
    localStorage.setItem('spazakhokha_voice_enabled', enabled ? 'true' : 'false')
  } catch {}
}

function speakAmount(spokenText) {
  try {
    if (!spokenText || !isVoiceEnabled() || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(spokenText)
    utter.lang = 'en-ZA'
    utter.rate = 1.02
    utter.pitch = 1.05
    utter.volume = 1.0
    window.speechSynthesis.speak(utter)
  } catch {}
}

function triggerScanFeedback(success = true, spokenText = '') {
  try {
    if (navigator.vibrate) navigator.vibrate(success ? [80, 40, 120] : [250])
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx()
      if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume()
      const ctx = sharedAudioCtx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(success ? 880 : 240, ctx.currentTime)
      if (success) osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.09)
      gain.gain.setValueAtTime(0.22, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    }
    if (spokenText) {
      setTimeout(() => speakAmount(spokenText), 180)
    }
  } catch {}
}

export function OfflineConsumerPayBox({ actorHandle, unitId, merchantWallet, amount: initialAmount, showToast }) {
  const [payAmount, setPayAmount] = useState(String(initialAmount || '5'))
  const [targetWallet, setTargetWallet] = useState(merchantWallet || '')
  const [targetUnit, setTargetUnit] = useState(unitId || 'unit-104')
  const [allowance, setAllowance] = useState(() => getSavedAllowance(actorHandle))
  const [lockAmount, setLockAmount] = useState('50')
  const [requestId, setRequestId] = useState(() => `req_${Date.now().toString(36)}`)
  const [signedQrUrl, setSignedQrUrl] = useState('')
  const [signedPkgJson, setSignedPkgJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanningReq, setScanningReq] = useState(false)
  const reqVideoRef = useRef(null)
  const reqCanvasRef = useRef(null)

  useEffect(() => {
    setTargetWallet(merchantWallet || '')
    setTargetUnit(unitId || 'unit-104')
    setSignedQrUrl('')
  }, [merchantWallet, unitId])

  useEffect(() => {
    setAllowance(getSavedAllowance(actorHandle))
    syncIssuerPublicKey().catch(() => {})
  }, [actorHandle])

  useEffect(() => {
    if (!scanningReq) return
    let stream = null
    let timer = null
    let cancelled = false
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then((s) => {
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
      stream = s
      if (reqVideoRef.current) {
        reqVideoRef.current.setAttribute('playsinline', 'true')
        reqVideoRef.current.srcObject = s
        reqVideoRef.current.play().catch(() => {})
      }
      timer = setInterval(() => {
        const vid = reqVideoRef.current
        const cvs = reqCanvasRef.current
        if (!vid || !cvs || vid.readyState < 2 || !vid.videoWidth) return
        cvs.width = vid.videoWidth
        cvs.height = vid.videoHeight
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)
        const decoded = decodeQrFromImageData(ctx.getImageData(0, 0, cvs.width, cvs.height))
        if (decoded) {
          try {
            const req = JSON.parse(decoded)
            if (req.t === 'req' && req.a) {
              setPayAmount((Number(req.a) / 100).toFixed(2))
              if (req.r) setRequestId(req.r)
              if (req.w) setTargetWallet(req.w)
              if (req.u) setTargetUnit(req.u)
              setScanningReq(false)
              triggerScanFeedback(true)
              showToast?.(`Cashier Request Loaded: Pay R${(Number(req.a) / 100).toFixed(2)}`, 'success')
            }
          } catch {}
        }
      }, 150)
    }).catch(() => {
      setScanningReq(false)
      showToast?.('Camera unavailable ? enter amount manually below', 'error')
    })
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [scanningReq])

  const remainingZar = allowance ? Math.max(0, (allowance.limitCents - allowance.spentCents) / 100) : 0

  const handleLock = async () => {
    setBusy(true)
    try {
      const limitCents = Math.round(Number(lockAmount) * 100)
      const { state } = await mintOfflineAllowance({ actorHandle, limitCents, mode: 'demo' })
      if (state) {
        setAllowance(state)
        showToast?.(`Locked R${(limitCents / 100).toFixed(2)} offline ECDSA allowance`, 'success')
      }
    } catch (err) {
      showToast?.(err.message || 'Allowance lock failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleSign = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const amountCents = Math.round(Number(payAmount) * 100)
      const { package: pkg, updatedState } = await signOfflinePaymentNote({
        actorHandle,
        requestId: requestId.trim() || `req_${Date.now().toString(36)}`,
        merchantWallet: targetWallet || merchantWallet,
        amountCents,
        unitId: targetUnit || unitId,
      })
      setAllowance(updatedState)
      const jsonStr = JSON.stringify(pkg)
      setSignedPkgJson(jsonStr)
      setSignedQrUrl(await generateQrDataUrl(encodeCompactOfflineQr(pkg)))
      setRequestId(`req_${Date.now().toString(36)}`)
      showToast?.(`Signed offline QR for R${(amountCents / 100).toFixed(2)}`, 'success')
    } catch (err) {
      showToast?.(err.message || 'Signing failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-xl bg-[#0F1735] border border-[#38E4AE]/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#38E4AE] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Offline Locked Balance (Ready Without Data)
          </span>
          <Badge variant={allowance ? 'mint' : 'default'}>
            {allowance ? `R${remainingZar.toFixed(2)} Left` : 'Not Locked'}
          </Badge>
        </div>
        {allowance && (
          <div className="text-[11px] text-[#9AA7C4] flex justify-between">
            <span>Cert: {allowance.allowanceId}</span>
            <span>Tx Cap: R{(allowance.txCapCents / 100).toFixed(2)} · Note #{allowance.counter}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Input type="number" min="5" max="500" value={lockAmount} onChange={(e) => setLockAmount(e.target.value)} className="h-8 text-xs w-28 tabular-nums font-bold" />
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={handleLock}>
            {allowance ? 'Update Locked Balance' : 'Lock Balance'}
          </Button>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-[#00A2E8]/10 border border-[#00A2E8]/30 text-[11px] text-[#D2D7DF]">
        <span className="font-bold text-[#00A2E8]">How to pay:</span> Scan the cashier&apos;s QR code to load the amount, tap <strong className="text-white">Approve &amp; Sign</strong>, then show your QR code to complete payment.
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="secondary" size="sm" className="w-full h-10" onClick={() => setScanningReq(!scanningReq)}>
          {scanningReq ? <><X className="w-4 h-4" /> Close Request Scanner</> : <><Camera className="w-4 h-4" /> Scan Cashier Request QR</>}
        </Button>
      </div>

      {scanningReq && (
        <div className="relative rounded-xl overflow-hidden border border-[#00A2E8]/60 bg-black">
          <video ref={reqVideoRef} className="w-full h-44 object-cover" muted playsInline />
          <canvas ref={reqCanvasRef} className="hidden" />
          <div className="absolute bottom-2 inset-x-0 text-center text-[11px] font-semibold text-[#00A2E8] bg-black/70 py-1">
            Point camera at Cashier&apos;s Amount QR...
          </div>
        </div>
      )}

      <form onSubmit={handleSign} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Purchase Amount (ZAR)</label>
            <Input type="number" step="0.5" min="0.5" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="tabular-nums font-bold" required />
          </div>
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Till Request ID</label>
            <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} className="font-mono-code text-xs" required />
          </div>
        </div>
        <Button type="submit" disabled={busy || !allowance} className="w-full h-11">
          <QrCode className="w-4 h-4" /> Approve &amp; Sign Payment QR (R{Number(payAmount || 0).toFixed(2)})
        </Button>
      </form>

      {signedQrUrl && (
        <div className="p-4 rounded-2xl bg-white text-[#0B1128] flex flex-col items-center gap-2">
          <img src={signedQrUrl} alt="Signed Offline QR" className="w-64 h-64" style={{ imageRendering: 'pixelated' }} />
          <div className="text-xs font-bold">Show QR to Cashier (100% Offline)</div>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(signedPkgJson); showToast?.('Copied signed JSON payload', 'info') }} className="text-[11px] font-semibold text-[#00A2E8] underline cursor-pointer">
            Copy Signed JSON Payload
          </button>
        </div>
      )}
    </div>
  )
}

export function OfflineMerchantTillBox({ unitId, merchantWallet, showToast, onQueueChange }) {
  const [issuerReady, setIssuerReady] = useState(() => Boolean(getCachedIssuerPub()))
  const [pkgInput, setPkgInput] = useState('')
  const [queue, setQueue] = useState(() => getMerchantOfflineQueue(unitId))
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [chargeZar, setChargeZar] = useState('15')
  const [requestQrUrl, setRequestQrUrl] = useState('')
  const [activeReqLabel, setActiveReqLabel] = useState('')
  const [voiceOn, setVoiceOn] = useState(() => isVoiceEnabled())
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    syncIssuerPublicKey().then((p) => setIssuerReady(Boolean(p))).catch(() => {})
    setQueue(getMerchantOfflineQueue(unitId))
  }, [unitId])

  const processRawPayload = async (rawStr) => {
    setBusy(true)
    try {
      const { entry, queue: nextQ } = await verifyAndQueueOfflinePackage(JSON.parse(rawStr.trim()), merchantWallet, unitId)
      setQueue(nextQ)
      onQueueChange?.(nextQ.length)
      setPkgInput('')
      const zarVal = (entry.amountCents / 100).toFixed(2).replace(/\.00$/, '')
      triggerScanFeedback(true, `Payment received, ${zarVal} Rand`)
      showToast?.(`Payment Received! R${(entry.amountCents / 100).toFixed(2)} from @${entry.payer}`, 'success')
    } catch (err) {
      triggerScanFeedback(false, 'Payment rejected')
      showToast?.(err.message || 'Offline verification failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!scanning) return
    let stream = null
    let timer = null
    let cancelled = false

    navigator.mediaDevices?.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        if (videoRef.current) {
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => {})
        }
        timer = setInterval(() => {
          const vid = videoRef.current
          const cvs = canvasRef.current
          if (!vid || !cvs || vid.readyState < 2 || !vid.videoWidth) return
          const w = vid.videoWidth
          const h = vid.videoHeight
          cvs.width = w
          cvs.height = h
          const ctx = cvs.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(vid, 0, 0, w, h)

          // Pass 1: Center 65% square crop (zooms in on dense phone-to-phone QR codes)
          const cropSize = Math.floor(Math.min(w, h) * 0.65)
          const sx = Math.floor((w - cropSize) / 2)
          const sy = Math.floor((h - cropSize) / 2)
          let decoded = decodeQrFromImageData(ctx.getImageData(sx, sy, cropSize, cropSize))

          // Pass 2: Full frame fallback
          if (!decoded) {
            decoded = decodeQrFromImageData(ctx.getImageData(0, 0, w, h))
          }
          if (decoded) {
            setScanning(false)
            processRawPayload(decoded)
          }
        }, 150)
      })
      .catch(() => {
        setScanning(false)
        showToast?.('Camera unavailable - use Upload QR Image or Paste JSON instead', 'error')
      })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [scanning])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = img.width
      cvs.height = img.height
      const ctx = cvs.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const decoded = decodeQrFromImageData(ctx.getImageData(0, 0, cvs.width, cvs.height))
      if (decoded) {
        processRawPayload(decoded)
      } else {
        showToast?.('No valid QR code found in image', 'error')
      }
    }
    img.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    await processRawPayload(pkgInput)
  }

  const totalZar = queue.reduce((s, x) => s + x.amountCents, 0) / 100

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-[#0F1735] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#9AA7C4]">Offline Keys:</span>
          <Badge variant={issuerReady ? 'mint' : 'default'}>{issuerReady ? 'Ready' : 'Sync Required'}</Badge>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !voiceOn
            setVoiceOn(next)
            setVoiceEnabledPref(next)
            if (next) {
              unlockAudio()
              speakAmount('Voice readout enabled')
            } else if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel()
            }
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
            voiceOn
              ? 'bg-[#38E4AE]/15 text-[#38E4AE] border-[#38E4AE]/40'
              : 'bg-white/[0.04] text-[#9AA7C4] border-white/10 hover:text-white'
          }`}
          title="Toggle spoken payment readout for accessibility or privacy"
        >
          {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {voiceOn ? 'Voice Readout: On' : 'Voice Readout: Off'}
        </button>
      </div>

      <div className="p-3.5 rounded-xl bg-[#0F1735] border border-[#00A2E8]/30 space-y-2.5">
        <div className="flex items-center justify-between"><span className="text-xs font-bold text-[#00A2E8]">1. Enter Basket Total</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00A2E8]/20 text-[#38C3FF] font-semibold">Show QR to Customer</span></div>
        <div className="grid grid-cols-4 gap-1.5">
          {['5', '10', '20', '50'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setChargeZar(preset)}
              className={`h-9 rounded-lg text-xs font-bold border transition cursor-pointer ${
                chargeZar === preset
                  ? 'bg-[#00A2E8] text-[#0B1128] border-[#00A2E8]'
                  : 'bg-[#0B1128] text-white border-white/15 hover:border-[#00A2E8]/60'
              }`}
            >
              R{preset}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.5"
            min="0.5"
            value={chargeZar}
            onChange={(e) => setChargeZar(e.target.value)}
            className="h-9 text-sm font-bold tabular-nums w-28"
            placeholder="15.00"
          />
          <Button
            type="button"
            size="sm"
            className="flex-1 h-9"
            onClick={async () => {
              const cents = Math.round(Number(chargeZar || 0) * 100)
              if (cents <= 0) return
              const reqCode = `req_${Date.now().toString(36)}`
              const url = await generateQrDataUrl({ t: 'req', a: cents, u: unitId, w: merchantWallet, r: reqCode })
              setRequestQrUrl(url)
              setActiveReqLabel(`R${(cents / 100).toFixed(2)} (${reqCode})`)
            }}
          >
            <QrCode className="w-4 h-4" /> Show Request QR
          </Button>
        </div>
        {requestQrUrl && (
          <div className="p-3 rounded-xl bg-white text-[#0B1128] flex flex-col items-center gap-1.5">
            <img src={requestQrUrl} alt="Cashier Payment Request QR" className="w-44 h-44" style={{ imageRendering: 'pixelated' }} />
            <div className="text-xs font-bold">Customer Scans to Pay {activeReqLabel}</div>
            <button type="button" onClick={() => { unlockAudio(); setRequestQrUrl(''); setScanning(true) }} className="text-[11px] font-semibold text-[#00A2E8] underline cursor-pointer">
              Done - Open Camera to Scan Customer Receipt
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1"><span className="text-xs font-bold text-[#38E4AE]">2. Scan Payment QR</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#38E4AE]/20 text-[#38E4AE] font-semibold">Receive Payment</span></div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" disabled={!issuerReady} onClick={() => { unlockAudio(); setScanning(!scanning) }}>
          {scanning ? <><X className="w-4 h-4" /> Stop Camera</> : <><Camera className="w-4 h-4" /> Scan QR (Camera)</>}
        </Button>
        <Button type="button" variant="secondary" disabled={!issuerReady} onClick={() => fileRef.current?.click()}>
          <ImageUp className="w-4 h-4" /> Upload QR Image
        </Button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {scanning && (
        <div className="relative rounded-xl overflow-hidden border border-[#38E4AE]/50 bg-black">
          <video ref={videoRef} className="w-full h-48 object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-2 inset-x-0 text-center text-[11px] font-semibold text-[#38E4AE] bg-black/60 py-1">
            Hold customer QR code steady in front of camera...
          </div>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-3">
        <textarea rows={2} value={pkgInput} onChange={(e) => setPkgInput(e.target.value)} placeholder='Or paste Customer Signed ECDSA QR JSON...' className="w-full rounded-xl bg-[#0B1128] border border-white/15 p-2.5 text-xs font-mono-code text-white" required />
        <Button type="submit" disabled={busy || !issuerReady} className="w-full h-11">
          <QrCode className="w-4 h-4" /> Verify Offline Signature &amp; Queue Note
        </Button>
      </form>
      {queue.length > 0 && (
        <div className="p-3 rounded-xl bg-[#0C2636] border border-[#38E4AE]/30 space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-[#38E4AE]">
            <span>Queued Offline Notes ({queue.length})</span>
            <span>R{totalZar.toFixed(2)} Ready</span>
          </div>
          {queue.map((item) => (
            <div key={item.id} className="flex justify-between text-[11px] text-white/90 bg-[#0B1128]/70 px-2.5 py-1 rounded-lg">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#38E4AE]" /> @{item.payer} (#{item.counter})</span>
              <span className="font-bold">R{(item.amountCents / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function OfflineBatchSyncBanner({ unitId, merchantWallet, onRefresh, showToast }) {
  const [queue, setQueue] = useState(() => getMerchantOfflineQueue(unitId))
  const [syncing, setSyncing] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [voiceOn, setVoiceOn] = useState(() => isVoiceEnabled())

  useEffect(() => {
    setQueue(getMerchantOfflineQueue(unitId))
    setLastReceipt(null)
  }, [unitId])
  const totalZar = queue.reduce((s, x) => s + x.amountCents, 0) / 100

  const handleSync = async () => {
    unlockAudio()
    setSyncing(true)
    try {
      const res = await settleOfflineQueueBatch(merchantWallet, unitId)
      setQueue(getMerchantOfflineQueue(unitId))
      setLastReceipt({
        settledAt: new Date().toLocaleTimeString(),
        totalZar: Number(res.total_settled_zar || 0),
        wallet: merchantWallet,
        unitId,
        results: res.results || [],
      })
      const settledSpeak = Number(res.total_settled_zar || 0).toFixed(2).replace(/\.00$/, '')
      triggerScanFeedback(true, `Settled ${settledSpeak} Rand via Open Payments`)
      showToast?.(`Settled R${Number(res.total_settled_zar || 0).toFixed(2)} via Open Payments!`, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Batch sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-[#121D42] border border-[#38E4AE]/35 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <WifiOff className="w-4 h-4 text-[#38E4AE]" />
            Offline Khokha ECDSA Batch Queue ({queue.length} Notes)
            <Badge variant={queue.length > 0 ? 'mint' : 'default'}>R{totalZar.toFixed(2)} Pending</Badge>
          </div>
          <p className="text-xs text-[#9AA7C4]">
            Destination ILP Pointer: <span className="font-mono-code text-[#00A2E8]">{merchantWallet || 'Unassigned'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !voiceOn
              setVoiceOn(next)
              setVoiceEnabledPref(next)
              if (next) {
                unlockAudio()
                speakAmount('Voice readout enabled')
              } else if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel()
              }
            }}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              voiceOn
                ? 'bg-[#38E4AE]/15 text-[#38E4AE] border-[#38E4AE]/40'
                : 'bg-[#0B1128] text-[#9AA7C4] border-white/10 hover:text-white'
            }`}
          >
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {voiceOn ? 'Voice On' : 'Voice Off'}
          </button>
          <Button type="button" disabled={syncing || queue.length === 0} onClick={handleSync}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync &amp; Settle Batch (R{totalZar.toFixed(2)})
          </Button>
        </div>
      </div>

      {lastReceipt && (
        <div className="p-3 rounded-xl bg-[#0B1128] border border-[#38E4AE]/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#38E4AE] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Open Payments Batch Settled ({lastReceipt.settledAt})
            </span>
            <Badge variant="mint">R{lastReceipt.totalZar.toFixed(2)} Transferred</Badge>
          </div>
          <div className="text-[11px] text-[#9AA7C4] font-mono-code break-all">
            Rail: Incoming Payment &rarr; Quote &rarr; Outgoing Payment | To: {lastReceipt.wallet}
          </div>
          {lastReceipt.results.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-white/10">
              {lastReceipt.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] text-white/90">
                  <span className="font-mono-code truncate max-w-[65%]">
                    {r.request_id || `Note #${i + 1}`} | {r.payment_id || r.outgoing_payment_id || r.status}
                  </span>
                  <span className="font-bold text-[#38E4AE]">
                    {r.amount_zar != null ? `R${Number(r.amount_zar).toFixed(2)}` : r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
