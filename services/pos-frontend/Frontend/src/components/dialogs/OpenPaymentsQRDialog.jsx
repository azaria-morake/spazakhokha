import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { QrCode, CheckCircle2, Copy } from 'lucide-react';

export default function OpenPaymentsQRDialog({ open, onOpenChange, showToast }) {
  const [copied, setCopied] = useState(false);
  const paymentPointer = "$ilp.rafiki.money/unit-104";

  const handleCopy = () => {
    navigator.clipboard?.writeText(paymentPointer);
    setCopied(true);
    showToast?.("Copied payment pointer to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300 mx-auto mb-1">
            <QrCode className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg">Open Payments / ILP QR</DialogTitle>
          <DialogDescription className="text-xs">
            Instant digital counter settlement via Interledger Protocol
          </DialogDescription>
        </DialogHeader>

        {/* QR Code SVG */}
        <div className="flex justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl my-2">
          <svg className="w-40 h-40" viewBox="0 0 160 160">
            <rect width="160" height="160" fill="#ffffff" rx="8" />
            <rect x="15" y="15" width="35" height="35" fill="#1b2f21" rx="4" />
            <rect x="22" y="22" width="21" height="21" fill="#ffffff" rx="2" />
            <rect x="27" y="27" width="11" height="11" fill="#1b2f21" />
            <rect x="110" y="15" width="35" height="35" fill="#1b2f21" rx="4" />
            <rect x="117" y="22" width="21" height="21" fill="#ffffff" rx="2" />
            <rect x="122" y="27" width="11" height="11" fill="#1b2f21" />
            <rect x="15" y="110" width="35" height="35" fill="#1b2f21" rx="4" />
            <rect x="22" y="117" width="21" height="21" fill="#ffffff" rx="2" />
            <rect x="27" y="122" width="11" height="11" fill="#1b2f21" />
            <rect x="60" y="20" width="8" height="8" fill="#047857" />
            <rect x="75" y="20" width="8" height="8" fill="#1b2f21" />
            <rect x="90" y="30" width="8" height="8" fill="#047857" />
            <rect x="60" y="45" width="8" height="8" fill="#1b2f21" />
            <rect x="75" y="55" width="8" height="8" fill="#047857" />
            <rect x="90" y="55" width="8" height="8" fill="#1b2f21" />
            <rect x="25" y="65" width="8" height="8" fill="#1b2f21" />
            <rect x="40" y="75" width="8" height="8" fill="#047857" />
            <rect x="20" y="90" width="8" height="8" fill="#1b2f21" />
            <rect x="115" y="65" width="8" height="8" fill="#047857" />
          </svg>
        </div>

        <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <code className="text-xs text-slate-800 font-mono truncate">{paymentPointer}</code>
          <button 
            type="button" 
            onClick={handleCopy}
            className="text-slate-500 hover:text-emerald-700 p-1 cursor-pointer"
            title="Copy address"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <DialogFooter className="mt-2">
          <Button 
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white" 
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
