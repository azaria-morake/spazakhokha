import React, { useState } from 'react';
import { FileText, PlusCircle, UserCheck } from 'lucide-react';
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
import { createPurchase } from '../../services/api';

export default function CreditTabsView({
  customers = [],
  purchases = [],
  onRefreshData,
  showToast
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.tab_balance || 0), 0);
  const owingCount = customers.filter(c => c.tab_balance > 0).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount) return;

    setSubmitting(true);
    const purchaseData = {
      customer_id: selectedCustomerId,
      items: items.trim() || 'General groceries',
      amount: Number(amount),
      notes: notes.trim()
    };

    try {
      await createPurchase(purchaseData);
      showToast?.(`Logged credit purchase of R${Number(amount).toFixed(2)} on tab!`, 'success');
      setItems('');
      setAmount('');
      setNotes('');
      onRefreshData?.();
    } catch (err) {
      console.warn("Failed to create purchase:", err);
      showToast?.("Failed to record credit purchase", "destructive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          INFORMAL CREDIT LEDGER
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Credit Tabs & Counter Purchases
        </h2>
        <p className="text-xs text-slate-500">
          Record counter credit sales and track customer obligations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Outstanding
            </span>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-amber-900">R{totalOutstanding.toFixed(2)}</h2>
            <p className="text-xs text-slate-500">Across all active customer tabs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customers With Tabs
            </span>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-slate-900">{owingCount}</h2>
            <p className="text-xs text-slate-500">Customers currently owing balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="lg:col-span-1 border border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Record a Credit Purchase</CardTitle>
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
                      {c.name} (Tab: R{Number(c.tab_balance || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Items Taken
                </label>
                <Input 
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  placeholder="e.g. 2 Albany bread, 2L Milk"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Amount (R)
                </label>
                <Input 
                  type="number"
                  step="0.50"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="34.00"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Note (optional)
                </label>
                <Input 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Promised to settle on Friday"
                />
              </div>

              <Button 
                type="submit" 
                disabled={submitting || !selectedCustomerId || !amount}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2 mt-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record Credit Purchase'}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Purchases Ledger Table */}
        <Card className="lg:col-span-2 overflow-hidden border border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/75 border-b border-slate-200 py-3">
            <CardTitle className="text-sm font-bold">Active Customer Tabs Ledger</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Balance Owed</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.filter(c => c.tab_balance > 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                    No outstanding tabs currently recorded!
                  </TableCell>
                </TableRow>
              ) : (
                customers.filter(c => c.tab_balance > 0).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-xs text-slate-900">{c.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{c.phone}</TableCell>
                    <TableCell className="font-bold text-xs text-amber-800">R{Number(c.tab_balance).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-slate-500">R{Number(c.credit_limit || 300).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="amber" className="text-[10px]">Owing</Badge>
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
