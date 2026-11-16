import React, { useState } from 'react';
import { Users, Search, UserPlus, Phone, CreditCard, Sparkles } from 'lucide-react';
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

export default function CustomersView({
  customers = [],
  onOpenAddCustomer,
  onRecordPurchaseForCustomer,
  onRecordRepaymentForCustomer
}) {
  const [search, setSearch] = useState('');

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
           (c.phone || '').includes(q) ||
           (c.id || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            CUSTOMER DIRECTORY
          </span>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Township Patrons & Credit Accounts
          </h2>
          <p className="text-xs text-slate-500">
            Manage customer tabs, loyalty points, and WhatsApp contact details.
          </p>
        </div>

        <Button onClick={onOpenAddCustomer} className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2">
          <UserPlus className="w-4 h-4" />
          <span>+ Add Customer</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name, phone or ID (e.g. Sipho)..."
          className="pl-9 h-10 bg-white rounded-xl border-slate-200"
        />
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Outstanding Tab</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Ubuntu Tokens</TableHead>
              <TableHead className="text-right">Quick Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                  No customers found. Click "+ Add Customer" to create an account.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-slate-500">{c.id}</TableCell>
                  <TableCell className="font-semibold text-xs text-slate-900">{c.name}</TableCell>
                  <TableCell className="text-xs text-slate-600">{c.phone}</TableCell>
                  <TableCell>
                    <span className={`font-bold text-xs ${c.tab_balance > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                      R{Number(c.tab_balance || 0).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">R{Number(c.credit_limit || 300).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="purple" className="text-xs">
                      {Number(c.ubuntu_tokens || c.loyalty_stamps || 0).toFixed(1)} UBU
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onRecordPurchaseForCustomer?.(c.id)}
                        className="text-xs h-7 px-2"
                      >
                        + Charge Tab
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => onRecordRepaymentForCustomer?.(c.id)}
                        className="text-xs h-7 px-2"
                      >
                        Repay
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
