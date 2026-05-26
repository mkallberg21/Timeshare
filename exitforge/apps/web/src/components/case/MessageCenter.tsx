'use client';

import { useState } from 'react';
import type { Message } from '@exitforge/shared';

interface Props {
  caseId: string;
  messages: Message[];
}

export function MessageCenter({ caseId, messages }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const json = await res.json() as { data: Message };
        setLocalMessages((prev) => [json.data, ...prev]);
        setContent('');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[500px]">
      <h3 className="text-base font-semibold text-white mb-4">Case Messages</h3>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {localMessages.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            No messages yet. Ask us anything about your case.
          </p>
        )}
        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === 'CLIENT' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.senderType === 'CLIENT'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-200'
              }`}
            >
              <p>{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.senderType === 'CLIENT' ? 'text-indigo-200' : 'text-slate-500'}`}>
                {msg.senderType === 'CLIENT' ? 'You' : msg.senderType === 'AI_AGENT' ? 'ExitForge AI' : 'Case Manager'}
                {' · '}
                {new Date(msg.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-4">
        <input
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Ask about your case..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
          disabled={sending}
        />
        <button
          onClick={() => void handleSend()}
          disabled={sending || !content.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
