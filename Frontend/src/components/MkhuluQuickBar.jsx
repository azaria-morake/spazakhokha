import React, { useState } from 'react';
import { Bot, Mic, Play, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { sendAgentMessage } from '../services/api';

export default function MkhuluQuickBar({ onRefreshData, showToast }) {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  const quickPrompts = [
    "Sipho took 2 brown bread on credit, R34",
    "Record R50 repayment from Sipho via Open Payments",
    "Launch a weekend 15% discount on Maize Meal for Spaza Uniti",
    "Setup bread stamp card: buy 9 loaves get 1 free"
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    setLastResponse(null);

    try {
      const res = await sendAgentMessage(command.trim());
      setLastResponse(res.response || "Action executed successfully by Mkhulu.");
      setCommand('');
      showToast?.("Agent processed instruction successfully!", "success");
      onRefreshData?.();
    } catch (err) {
      console.warn("Agent execution error:", err);
      setLastResponse("Could not reach backend agent. Please check Port 8000.");
      showToast?.("Agent processing failed. Check backend connection.", "destructive");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePromptClick = (prompt) => {
    setCommand(prompt);
  };

  return (
    <section className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Mkhulu AI Co-Pilot</h3>
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
              Zero-UI Voice & Chat
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Speak or type naturally. e.g. <em>"Sipho took 2 brown bread on credit, R34"</em> or <em>"Thabo paid R50 via Open Payments"</em>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Input 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Tell Mkhulu what happened at the counter..."
            className="bg-white border-slate-300 pr-10 focus-visible:ring-emerald-600 h-10 rounded-xl"
            disabled={isProcessing}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700 cursor-pointer"
            title="Speech input"
            onClick={() => {
              showToast?.("Microphone active. Speak now...", "info");
            }}
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>

        <Button 
          type="submit" 
          disabled={isProcessing || !command.trim()}
          className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-10 px-5 gap-2"
        >
          {isProcessing ? (
            <Sparkles className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{isProcessing ? 'Processing...' : 'Process'}</span>
        </Button>
      </form>

      {/* Response Box */}
      {lastResponse && (
        <div className="bg-white border border-emerald-300 rounded-xl p-3 mb-3 flex items-start gap-2.5 text-xs text-slate-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-emerald-900 block font-semibold">Mkhulu:</strong>
            <p className="mt-0.5 whitespace-pre-line">{lastResponse}</p>
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick counter actions:</span>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handlePromptClick(prompt)}
            className="text-[11px] bg-white hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 border border-slate-200 hover:border-emerald-300 rounded-full px-2.5 py-1 transition-colors cursor-pointer"
          >
            "{prompt}"
          </button>
        ))}
      </div>
    </section>
  );
}
