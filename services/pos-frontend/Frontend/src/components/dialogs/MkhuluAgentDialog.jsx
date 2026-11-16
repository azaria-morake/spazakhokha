import React, { useState, useEffect, useRef } from 'react';
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
import { Bot, Mic, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { sendAgentMessage } from '../../services/api';

export default function MkhuluAgentDialog({ 
  open, 
  onOpenChange, 
  onActionComplete, 
  showToast 
}) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Sawubona Baba! I am your SpazaKhokha AI Co-Pilot. You don't need to navigate menus or type forms. Just tell me what happened at the counter, or ask me to manage your Spaza Uniti promotions and community loyalty pacts.",
      time: "Just now"
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputVal.trim() || loading) return;

    const userText = inputVal.trim();
    setInputVal('');

    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: userText, time: 'Just now' }
    ]);
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const res = await sendAgentMessage(userText, history);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.response || "Task completed.",
          time: 'Just now'
        }
      ]);
      showToast?.("Mkhulu executed the request!", "success");
      onActionComplete?.();
    } catch (err) {
      console.warn("Agent dialog error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: "I encountered an error communicating with the local engine. Please verify the backend server.",
          time: 'Just now'
        }
      ]);
      showToast?.("Agent error", "destructive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base flex items-center gap-2">
                Mkhulu AI Store Partner
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  Online
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Township Commerce Co-Pilot • Powered by Agentic LLM & Ubuntu Economics
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[420px] bg-slate-50/50">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 p-2.5 rounded-xl w-fit">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Mkhulu is thinking and tool-calling...</span>
            </div>
          )}
          <div ref={feedEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
          <Input 
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type or simulate: 'Sipho settled R40 cash'..."
            className="flex-1 h-10 rounded-xl"
            disabled={loading}
          />
          <Button 
            onClick={handleSend}
            disabled={loading || !inputVal.trim()}
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-10 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
