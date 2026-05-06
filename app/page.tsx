'use client';

import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

interface Message {
  _id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
}

type Stage = 'login' | 'select-target' | 'chat';

export default function ChatPage() {
  const [stage, setStage] = useState<Stage>('login');
  const [userID, setUserID] = useState('');
  const [targetID, setTargetID] = useState('');
  const [inputUser, setInputUser] = useState('');
  const [inputTarget, setInputTarget] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendUniqueMessage(msg: Message) {
    setMessages((prev) => {
      if (prev.some((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  }

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up Pusher subscription when chat starts
  useEffect(() => {
    if (stage !== 'chat') return;
    const channelName = `chat-${[userID, targetID].sort().join('-')}`;
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    let pusher: Pusher | null = null;
    let ch: ReturnType<Pusher['subscribe']> | null = null;

    setRuntimeError('');

    if (pusherKey && pusherCluster) {
      try {
        pusher = new Pusher(pusherKey, { cluster: pusherCluster });
        ch = pusher.subscribe(channelName);
        ch.bind('new-message', (data: Message) => {
          appendUniqueMessage(data);
        });
      } catch {
        setRuntimeError('Realtime is temporarily unavailable. You can still chat by sending messages.');
      }
    } else {
      setRuntimeError('Realtime config is missing on deployment (NEXT_PUBLIC_PUSHER_*).');
    }

    // Load history
    fetch(`/api/message?user1=${encodeURIComponent(userID)}&user2=${encodeURIComponent(targetID)}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error('Failed to load message history');
        }
        return r.json();
      })
      .then((data) => setMessages(Array.isArray(data.messages) ? data.messages : []))
      .catch(() => {
        setRuntimeError((prev) => prev || 'Cannot load messages right now. Please try again later.');
      });

    return () => {
      if (ch) ch.unbind_all();
      if (pusher) {
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      }
    };
  }, [stage, userID, targetID]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: userID, to: targetID, text: newText.trim() }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Failed to send message');
      }

      if (payload?.message) {
        appendUniqueMessage(payload.message as Message);
      }

      setNewText('');
      setRuntimeError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setRuntimeError(message);
    } finally {
      setSending(false);
    }
  }

  // ---- Render ----

  if (stage === 'login') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <form
          className="flex flex-col gap-4 rounded-2xl bg-white p-10 shadow-md w-80"
          onSubmit={(e) => {
            e.preventDefault();
            if (!inputUser.trim()) return;
            setUserID(inputUser.trim());
            setStage('select-target');
          }}
        >
          <h1 className="text-2xl font-bold text-center text-gray-800">Simple Chat</h1>
          <input
            className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter your User ID"
            value={inputUser}
            onChange={(e) => setInputUser(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-500 py-2 text-white font-semibold hover:bg-blue-600 transition"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  if (stage === 'select-target') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <form
          className="flex flex-col gap-4 rounded-2xl bg-white p-10 shadow-md w-80"
          onSubmit={(e) => {
            e.preventDefault();
            if (!inputTarget.trim()) return;
            setTargetID(inputTarget.trim());
            setStage('chat');
          }}
        >
          <h1 className="text-2xl font-bold text-center text-gray-800">Logged in as</h1>
          <p className="text-center text-blue-600 font-mono font-semibold text-lg">{userID}</p>
          <input
            className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Chat with (User ID)"
            value={inputTarget}
            onChange={(e) => setInputTarget(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-lg bg-green-500 py-2 text-white font-semibold hover:bg-green-600 transition"
          >
            Start Chat
          </button>
        </form>
      </main>
    );
  }

  // Chat stage
  return (
    <main className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between bg-blue-600 px-6 py-3 text-white shadow">
        <span className="font-semibold">You: <span className="font-mono">{userID}</span></span>
        <span className="text-sm opacity-80">↔</span>
        <span className="font-semibold">Chat with: <span className="font-mono">{targetID}</span></span>
      </header>

      {/* Messages */}
      <section className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {runtimeError && (
          <p className="mx-auto mb-4 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {runtimeError}
          </p>
        )}
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10">No messages yet. Say hello!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.from === userID;
          return (
            <div key={msg._id ?? msg.createdAt} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm shadow ${
                  isMine
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none'
                }`}
              >
                {!isMine && (
                  <p className="text-xs font-semibold text-gray-500 mb-1">{msg.from}</p>
                )}
                <p>{msg.text}</p>
                <p className={`text-xs mt-1 text-right ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </section>

      {/* Input */}
      <form
        className="flex gap-2 border-t border-gray-200 bg-white px-4 py-3"
        onSubmit={sendMessage}
      >
        <input
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type a message..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!newText.trim() || sending}
          className="rounded-full bg-blue-500 px-5 py-2 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition"
        >
          Send
        </button>
      </form>
    </main>
  );
}


