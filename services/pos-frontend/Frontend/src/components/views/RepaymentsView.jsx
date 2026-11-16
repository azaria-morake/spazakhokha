import React, { useState } from 'react';
import { Coins, CheckCircle2, ArrowDownLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { createRepayment } from '../../services/api';

export default function RepaymentsView({
  customers = [],
  repayments = [],
  onRefreshData,
  showToast
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount) return;

    setSubmitting(true);
    const repaymentData = {
      customer_id: selectedCustomerId,
      amount: Number(amount),
      method,
      notes: notes.trim()
    };

    try {
      await createRepayment(repaymentData);
      showToast?.(`Recorded R${Number(amount).toFixed(2)} repayment via ${method}!`, 'success');
      setAmount('');
      setNotes('');
      onRefreshData?.();
    } catch (err) {
      console.warn("Failed to record repayment:", err);
      showToast?.("Failed to record repayment", "destructive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          DEBT RECONCILIATION
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Tab Repayments & Settlements
        </h2>
        <p className="text-xs text-slate-500">
          Record customer payments received in cash or via Open Payments Interledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="lg:col-span-1 border border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Record a Repayment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Select Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                >
                  <option value="">Choose a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Owing: R{Number(c.tab_balance || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Amount Paid (R)
                </label>
                <Input 
                  type="number"
                  step="0.50"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50.00"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                >
                  <option value="Cash">Cash at Counter</option>
                  <option value="Open Payments">Open Payments / ILP Wallet</option>
                  <option value="EFT">Bank EFT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Note (optional)
                </label>
                <Input 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Settle Friday debt"
                />
              </div>

              <Button 
                type="submit" 
                disabled={submitting || !selectedCustomerId || !amount}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2 mt-2"
              >
                <Coins className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record Repayment'}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Repayments Ledger Table */}
        <Card className="lg:col-span-2 overflow-hidden border border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/75 border-b border-slate-200 py-3">
            <CardTitle className="text-sm font-bold">Recent Repayments Ledger</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                    No repayments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                repayments.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs text-slate-900">{r.customer_name || r.customer_id}</TableCell>
                    <TableCell className="font-bold text-xs text-emerald-700">R{Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <Badge variant={r.method === 'Open Payments' ? 'purple' : 'secondary'} className="text-[10px]">
                        {r.method || 'Cash'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{r.notes || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="emerald" className="text-[10px]">Settled</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
