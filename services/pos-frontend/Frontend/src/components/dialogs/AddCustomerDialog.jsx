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
import { Input } from '../ui/input';
import { UserPlus, Check } from 'lucide-react';
import { createCustomer } from '../../services/api';

export default function AddCustomerDialog({ 
  open, 
  onOpenChange, 
  onCreated, 
  showToast 
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState(300);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitting(true);
    const newCust = {
      name: name.trim(),
      phone: phone.trim(),
      credit_limit: Number(creditLimit) || 300,
      notes: notes.trim(),
    };

    try {
      await createCustomer(newCust);
      showToast?.(`Customer "${name}" registered successfully!`, 'success');
      onCreated?.();
      onOpenChange(false);
      setName('');
      setPhone('');
      setNotes('');
    } catch (err) {
      console.warn("Failed to create customer:", err);
      showToast?.("Failed to register customer", "destructive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Register Customer Account</DialogTitle>
              <DialogDescription className="text-xs">
                Add a new patron tab for tracking informal credit and Ubuntu Token rewards.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Full Name
            </label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="e.g. Sipho Dlamini" 
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Phone Number (WhatsApp)
            </label>
            <Input 
              type="tel" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required 
              placeholder="e.g. 082 123 4567" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Credit Limit (R)
              </label>
              <Input 
                type="number" 
                min={50} 
                max={5000} 
                step={10} 
                value={creditLimit} 
                onChange={(e) => setCreditLimit(e.target.value)} 
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
                placeholder="e.g. House 412" 
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting} 
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Registering...' : 'Register Customer'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
