import { useState, useRef, useEffect } from 'react'
import { objectivesChat } from '../api/sheets'

// Starters exist so the chat never opens as a blank box — every entry point
// already carries the intent, which is what makes it usable one-handed.
const STARTERS = [
  { label: 'Plan my day', prompt: 'Help me decide what to work on today based on my objectives, their due dates, and their steps.' },
  { label: 'Break down an objective', prompt: 'Help me create a concrete set of steps for one of my objectives. Ask me which one first.' },
  { label: 'Brainstorm objectives', prompt: 'Help me brainstorm new objectives. Ask what areas I want to improve before suggesting anything.' },
  { label: 'Review my progress', prompt: 'Review my objectives — what is overdue, what is on track, and what I should drop.' },
  { label: 'Think long term', prompt: 'Help me think about my long term objectives. Are they still the right direction, and is my short and mid term work actually feeding them?' },
]

export default function ObjectivesChat({ onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(() => localStorage.getItem('fittrack_ai_model') || 'sonnet')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  function pickModel(next) {
    setModel(next)
    localStorage.setItem('fittrack_ai_model', next)
  }

  async function send(history) {
    setMessages(history)
    setError(null)
    setPending(true)
    try {
      const data = await objectivesChat(history, model)
      setMessages([...history, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    send([...messages, { role: 'user', content: text }])
  }

  // The failed turn is still the last message, so resending the same history retries it.
  function handleRetry() {
    if (pending) return
    send(messages)
  }

  return (
    // pb-40 clears the fixed input bar plus the fixed bottom nav beneath it
    <div className="p-4 pb-40">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="text-teal-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold flex-1">Coach</h1>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null) }}
            className="text-gray-400 text-sm font-semibold px-3 min-h-[44px]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[{ id: 'sonnet', label: 'Sonnet' }, { id: 'opus', label: 'Opus' }].map(m => (
          <button
            key={m.id}
            onClick={() => pickModel(m.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold min-h-[44px] ${
              model === m.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {messages.length === 0 && !pending && (
          <>
            <p className="text-gray-400 text-sm mb-2">What do you want to think about?</p>
            {STARTERS.map(s => (
              <button
                key={s.label}
                onClick={() => send([{ role: 'user', content: s.prompt }])}
                className="w-full text-left bg-gray-800 rounded-xl p-4 min-h-[48px] border border-gray-700 active:bg-gray-700"
              >
                <p className="font-semibold">{s.label}</p>
              </button>
            ))}
          </>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user'
              ? 'bg-teal-700 rounded-xl p-3 ml-8'
              : 'bg-gray-800 rounded-xl p-3 mr-8 border border-gray-700'}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}

        {pending && (
          <div className="bg-gray-800 rounded-xl p-3 mr-8 border border-gray-700">
            <p className="text-gray-400">Thinking...</p>
          </div>
        )}

        {error && (
          <div className="bg-gray-900 rounded-xl p-3 mr-8 border border-red-500">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <button
              onClick={handleRetry}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-20 left-0 right-0 p-3 flex gap-2 bg-gray-950 border-t border-gray-800">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything..."
          className="flex-1 bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500 min-h-[48px]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || pending}
          className="bg-purple-600 text-white px-5 rounded-lg font-semibold min-h-[48px] active:bg-purple-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
