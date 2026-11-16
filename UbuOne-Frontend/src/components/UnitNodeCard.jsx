import React, { useState } from 'react'
import { Check, Copy, MoreVertical, Wifi, ExternalLink } from 'lucide-react'
import { UbuOneLogo, UbuOneOrbitalMark, DeterministicQrSvg } from './UbuOneBrand'
import { Button, Dialog, DialogHeader, Badge } from './ui/primitives'

/**
 * Metallic Midnight Gradient Unit Node Card modeled on the "My Cards" visual widget in ubu-one-ui.jpeg.
 */
export function UnitNodeCard({
  unitId = 'unit-104',
  unitName = 'Khumalo Spaza Store',
  township = 'Soweto',
  openPaymentsId = '$spazauniti.org/unit-104',
  broadcastEnabled = true,
  cardHeading = 'Unit Node Card',
  statusLabel,
  modalTitle = 'Unit Open Payments Node',
  modalSubtitle = 'Scan at the counter or paste the ILP pointer for R0-fee UBU deposits & wholesaler settlement.',
  footerCta = 'Counter QR',
  onNavigateTab,
  ctaTab = 'pacts',
  ctaLabel = 'Manage Pacts',
}) {
  const [qrOpen, setQrOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyPointer = (text) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <>
      <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold text-white tracking-tight">
            {cardHeading}
          </h3>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="p-1.5 rounded-lg text-[#9AA7C4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Inspect Node Pointer & QR"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Node Card Surface matching ubu-one-ui.jpeg */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="relative w-full text-left overflow-hidden rounded-2xl p-4 min-h-[152px] flex flex-col justify-between border border-white/15 transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer group"
          style={{
            background:
              'linear-gradient(135deg, #1A2B5E 0%, #101A3B 54%, #091026 100%)',
            boxShadow: '0 14px 30px -12px rgba(0, 162, 232, 0.25)',
          }}
        >
          {/* Ambient glowing right orbital graphic matching ubu-one-ui.jpeg */}
          <div className="absolute -right-7 -bottom-7 opacity-85 group-hover:opacity-100 transition-opacity pointer-events-none">
            <UbuOneOrbitalMark className="w-36 h-36" />
          </div>
          <div
            className="absolute -right-10 -top-10 w-36 h-36 rounded-full blur-2xl opacity-30 pointer-events-none"
            style={{ background: '#00A2E8' }}
          />

          {/* Top Row: Mini Logo + Broadcast Status */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <UbuOneLogo size="sm" showMark={false} />
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                broadcastEnabled
                  ? 'bg-emerald-500/20 text-[#38E4AE]'
                  : 'bg-white/10 text-[#D2D7DF]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  broadcastEnabled ? 'bg-[#38E4AE]' : 'bg-[#9AA7C4]'
                }`}
              />
              {statusLabel || (broadcastEnabled ? 'LIVE' : 'PAUSED')}
            </span>
          </div>

          {/* Middle Row: EMV-style chip + NFC contactless */}
          <div className="relative z-10 flex items-center gap-2.5 my-2">
            <div className="w-8 h-6 rounded-md bg-gradient-to-br from-[#E2E8F0] to-[#94A3B8] border border-white/30 flex items-center justify-center shadow-inner">
              <div className="w-5 h-3.5 border border-[#0F1735]/35 rounded-xs" />
            </div>
            <Wifi className="w-4 h-4 text-[#D2D7DF] rotate-90 opacity-85" />
          </div>

          {/* Bottom Row: Open Payments Node Pointer + Overlapping Cyber/Silver Mark */}
          <div className="relative z-10 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-[#9AA7C4] font-medium truncate">
                {unitName}
              </div>
              <div className="text-xs font-semibold text-white font-mono-code truncate mt-0.5">
                {openPaymentsId}
              </div>
            </div>

            {/* Dual circle rail emblem in Cyber Blue + Digital Silver */}
            <div className="flex items-center -space-x-2 shrink-0">
              <span className="w-5 h-5 rounded-full bg-[#00A2E8]/90 border border-white/20" />
              <span className="w-5 h-5 rounded-full bg-[#D2D7DF]/85 border border-white/20" />
            </div>
          </div>
        </button>

        <div className="mt-3 flex items-center justify-between text-[11px] text-[#9AA7C4]">
          <span>{township} · @{unitId}</span>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="text-[#38C3FF] hover:text-white font-semibold cursor-pointer"
          >
            {footerCta}
          </button>
        </div>
      </div>

      {/* Counter QR & Open Payments Pointer Modal */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen} maxWidth="max-w-md">
        <DialogHeader
          title={modalTitle}
          subtitle={modalSubtitle}
          onClose={() => setQrOpen(false)}
        />

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-[#0B1128] border border-[#00A2E8]/30 shadow-[0_0_30px_rgba(0,162,232,0.18)]">
            <DeterministicQrSvg value={openPaymentsId} size={172} />
          </div>

          <div className="w-full space-y-2 text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA7C4]">
              Open Payments Pointer
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0B1128] border border-white/10">
              <code className="text-xs text-[#38C3FF] font-mono-code truncate">
                {openPaymentsId}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copyPointer(openPaymentsId)}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#38E4AE]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A254B]/70 border border-white/8 text-xs">
            <span className="text-[#D2D7DF]">Discovery URL</span>
            <a
              href={`http://localhost:8001/${unitId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#38C3FF] hover:underline font-mono-code"
            >
              localhost:8001/{unitId}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="w-full flex items-center justify-between gap-2 pt-2">
            <Badge variant={broadcastEnabled ? 'mint' : 'default'}>
              {statusLabel || (broadcastEnabled ? 'Live on SpazaUniti' : 'Broadcast Paused')}
            </Badge>
            <div className="flex gap-2">
              {onNavigateTab && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQrOpen(false)
                    onNavigateTab(ctaTab)
                  }}
                >
                  {ctaLabel}
                </Button>
              )}
              <Button size="sm" onClick={() => setQrOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}

