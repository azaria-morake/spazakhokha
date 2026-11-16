import React from 'react';
import { 
  TrendingUp, 
  FileText, 
  Users, 
  Sparkles, 
  PlusCircle, 
  Coins, 
  QrCode, 
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2
} from 'lucide-react';
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

export default function DashboardView({
  dashboardMetrics,
  transactions = [],
  customers = [],
  onNavigate,
  onOpenQR
}) {
  const sales = dashboardMetrics?.sales || 0;
  const outstanding = dashboardMetrics?.outstanding || 0;
  const customerCount = customers.length || 0;

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Today's Sales
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              +14% vs yesterday
            </span>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-slate-900">R{Number(sales).toFixed(2)}</h2>
            <p className="text-xs text-slate-500 mt-1">All recorded counter & digital sales</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200/80 bg-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Tabs
            </span>
            <Badge variant="amber">Credit Ledger</Badge>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-amber-900">R{Number(outstanding).toFixed(2)}</h2>
            <p className="text-xs text-amber-700 mt-1">{customers.filter(c => c.tab_balance > 0).length} customers owing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Spaza Uniti Shoppers
            </span>
            <Badge variant="emerald">Connected</Badge>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-slate-900">{customerCount}</h2>
            <p className="text-xs text-slate-500 mt-1">Registered township patrons</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Uniti Offerings
            </span>
            <Badge variant="purple">Live Now</Badge>
          </CardHeader>
          <CardContent>
            <h2 className="text-2xl font-bold text-slate-900">6</h2>
            <p className="text-xs text-slate-500 mt-1">4 Loyalty Pacts • 2 Specials</p>
          </CardContent>
        </Card>
      </div>

      {/* Instant Workflows Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            FAST COUNTER ACTIONS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('creditTabs')}
            className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold text-slate-900 block">Record Credit Sale</strong>
              <span className="text-[11px] text-slate-500">Log item taken on tab</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('repayments')}
            className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-700 group-hover:text-white transition-colors">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold text-slate-900 block">Record Repayment</strong>
              <span className="text-[11px] text-slate-500">Cash or Open Payments</span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenQR}
            className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold text-slate-900 block">Open Payments QR</strong>
              <span className="text-[11px] text-slate-500">Instant counter QR code</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('offerings')}
            className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-700 group-hover:text-white transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold text-slate-900 block">Manage Offerings</strong>
              <span className="text-[11px] text-slate-500">Loyalty & specials</span>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              STORE ACTIVITY & AUDIT LOG
            </span>
            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
          </div>
          <Badge variant="secondary" className="gap-1 text-slate-600">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Auto-reconciled by Agent
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                  Your transactions will appear here as credit purchases or repayments occur.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant={tx.type === 'Credit Purchase' ? 'amber' : 'emerald'} className="text-[10px]">
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-slate-900">{tx.customer}</TableCell>
                  <TableCell className="text-xs text-slate-600">{tx.details}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-900">R{Number(tx.amount || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-slate-600">{tx.method || 'Cash'}</TableCell>
                  <TableCell className="text-xs text-slate-500">{tx.source || 'Counter POS'}</TableCell>
                  <TableCell className="text-xs text-slate-400">{tx.created_at || 'Recently'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
