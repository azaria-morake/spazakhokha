import React, { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImageUp, Loader2, QrCode, RefreshCw, ShieldCheck, WifiOff, X } from 'lucide-react'
import { Badge, Button, Input } from './ui/primitives'
import {
  decodeQrFromImageData,
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

export function OfflineConsumerPayBox({ actorHandle, unitId, merchantWallet, amount: initialAmount, showToast }) {
  const [payAmount, setPayAmount] = useState(String(initialAmount || '5'))
  const [allowance, setAllowance] = useState(() => getSavedAllowance(actorHandle))
  const [lockAmount, setLockAmount] = useState('50')
  const [requestId, setRequestId] = useState(() => `req_${Date.now().toString(36)}`)
  const [signedQrUrl, setSignedQrUrl] = useState('')
  const [signedPkgJson, setSignedPkgJson] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setAllowance(getSavedAllowance(actorHandle))
    syncIssuerPublicKey().catch(() => {})
  }, [actorHandle])

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
        merchantWallet,
        amountCents,
        unitId,
      })
      setAllowance(updatedState)
      const jsonStr = JSON.stringify(pkg)
      setSignedPkgJson(jsonStr)
      setSignedQrUrl(await generateQrDataUrl(jsonStr))
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
            <ShieldCheck className="w-4 h-4" /> P-256 ECDSA Offline Allowance
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
            {allowance ? 'New Certificate' : 'Lock Offline Allowance'}
          </Button>
        </div>
      </div>

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
          <QrCode className="w-4 h-4" /> Sign Offline Payment QR (R{Number(payAmount || 0).toFixed(2)})
        </Button>
      </form>

      {signedQrUrl && (
        <div className="p-4 rounded-2xl bg-white text-[#0B1128] flex flex-col items-center gap-2">
          <img src={signedQrUrl} alt="Signed Offline QR" className="w-44 h-44" />
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
      showToast?.(`Verified ECDSA signature! Queued R${(entry.amountCents / 100).toFixed(2)} from @${entry.payer}`, 'success')
    } catch (err) {
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

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
        timer = setInterval(() => {
          const vid = videoRef.current
          const cvs = canvasRef.current
          if (!vid || !cvs || vid.readyState < 2) return
          cvs.width = vid.videoWidth
          cvs.height = vid.videoHeight
          const ctx = cvs.getContext('2d')
          ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)
          const decoded = decodeQrFromImageData(ctx.getImageData(0, 0, cvs.width, cvs.height))
          if (decoded) {
            setScanning(false)
            processRawPayload(decoded)
          }
        }, 300)
      })
      .catch(() => {
        setScanning(false)
        showToast?.('Camera unavailable ? use Upload QR Image or Paste JSON instead', 'error')
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
      <div className="p-3 rounded-xl bg-[#0F1735] border border-white/10 flex items-center justify-between text-xs">
        <span className="text-[#9AA7C4]">Local Issuer Key Cache:</span>
        <Badge variant={issuerReady ? 'mint' : 'default'}>{issuerReady ? 'Verified & Ready Offline' : 'Sync Required'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" disabled={!issuerReady} onClick={() => setScanning(!scanning)}>
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

  useEffect(() => { setQueue(getMerchantOfflineQueue(unitId)) }, [unitId])
  const totalZar = queue.reduce((s, x) => s + x.amountCents, 0) / 100

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await settleOfflineQueueBatch(merchantWallet, unitId)
      setQueue(getMerchantOfflineQueue(unitId))
      showToast?.(`Settled R${Number(res.total_settled_zar || 0).toFixed(2)} via Open Payments!`, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Batch sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-[#121D42] border border-[#38E4AE]/35 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <WifiOff className="w-4 h-4 text-[#38E4AE]" />
          Offline Khokha ECDSA Batch Queue ({queue.length} Notes)
          <Badge variant={queue.length > 0 ? 'mint' : 'default'}>R{totalZar.toFixed(2)} Pending</Badge>
        </div>
        <p className="text-xs text-[#9AA7C4]">Verify and settle offline counter notes into Unit UBU via Open Payments.</p>
      </div>
      <Button type="button" disabled={syncing || queue.length === 0} onClick={handleSync}>
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Sync &amp; Settle Batch (R{totalZar.toFixed(2)})
      </Button>
    </div>
  )
}
