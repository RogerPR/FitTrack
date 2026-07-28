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

// Assistant turns are stored as the raw content blocks the API returned
// (thinking, text, tool_use) so they can be replayed verbatim on the next turn.
// Only the text is worth rendering; tool_result turns render as nothing.
function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter(b => b.type === 'text').map(b => b.text).join('')
}

export default function ObjectivesChat({ onClose, onChanged }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [failedWrite, setFailedWrite] = useState(false)
  const [actions, setActions] = useState([])
  const [model, setModel] = useState(() => localStorage.getItem('fittrack_ai_model') || 'sonnet')
  const [starter, setStarter] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, actions])

  function pickModel(next) {
    setModel(next)
    localStorage.setItem('fittrack_ai_model', next)
  }

  function reset() {
    setMessages([])
    setActions([])
    setError(null)
    setFailedWrite(false)
    setStarter(null)
  }

  // `decisions` maps tool_use ids to true/false. Present only on a confirm turn,
  // which is the only turn that can write anything.
  async function send(history, decisions) {
    setMessages(history)
    setActions([])
    setError(null)
    setFailedWrite(false)
    setPending(true)
    try {
      const data = await objectivesChat(history, model, decisions)
      const next = [...history]
      if (data.toolResults) next.push({ role: 'user', content: data.toolResults })
      next.push({ role: 'assistant', content: data.content })
      setMessages(next)
      setActions(data.actions || [])
      if (decisions) onChanged?.()
    } catch (err) {
      setError(err.message)
      // A write may or may not have landed before the failure, so resending is
      // not safe and the objectives list can no longer be trusted.
      setFailedWrite(!!decisions)
      if (decisions) onChanged?.()
    } finally {
      setPending(false)
    }
  }

  function decide(approve) {
    if (pending || !actions.length) return
    const decisions = {}
    for (const a of actions) decisions[a.id] = approve
    send(messages, decisions)
  }

  // A picked starter can be sent bare, or with whatever the user typed appended
  // to it — so the fast path stays one tap and steering costs nothing extra.
  function handleSend() {
    if (pending || actions.length) return
    const text = input.trim()
    if (!text && !starter) return
    const content = starter
      ? (text ? starter.prompt + '\n\n' + text : starter.prompt)
      : text
    setInput('')
    setStarter(null)
    send([...messages, { role: 'user', content }])
  }

  // The failed turn is still the last message, so resending the same history retries it.
  function handleRetry() {
    if (pending) return
    send(messages)
  }

  return (
    // pb clears the fixed input bar plus the fixed bottom nav beneath it, and
    // the starter chip makes that bar taller
    <div className={`p-4 ${starter ? 'pb-56' : 'pb-40'}`}>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="text-teal-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold flex-1">Coach</h1>
        {messages.length > 0 && (
          <button
            onClick={reset}
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
                onClick={() => setStarter(s)}
                className={`w-full text-left rounded-xl p-4 min-h-[48px] border active:bg-gray-700 ${
                  starter?.label === s.label
                    ? 'bg-gray-800 border-purple-500'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                <p className="font-semibold">{s.label}</p>
              </button>
            ))}
          </>
        )}

        {messages.map((m, i) => {
          const text = textOf(m.content)
          if (!text) return null
          return (
            <div
              key={i}
              className={m.role === 'user'
                ? 'bg-teal-700 rounded-xl p-3 ml-8'
                : 'bg-gray-800 rounded-xl p-3 mr-8 border border-gray-700'}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
            </div>
          )
        })}

        {pending && (
          <div className="bg-gray-800 rounded-xl p-3 mr-8 border border-gray-700">
            <p className="text-gray-400">Thinking...</p>
          </div>
        )}

        {actions.length > 0 && !pending && (
          <div className="bg-gray-800 rounded-xl p-3 mr-8 border border-purple-500">
            <p className="text-purple-300 text-sm font-semibold mb-2">Change your objectives?</p>
            <ul className="mb-3 space-y-1">
              {actions.map(a => (
                <li key={a.id} className="text-sm leading-relaxed">&bull; {a.label}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => decide(true)}
                className="flex-1 bg-purple-600 text-white px-4 rounded-lg font-semibold min-h-[48px] active:bg-purple-700"
              >
                Do it
              </button>
              <button
                onClick={() => decide(false)}
                className="flex-1 bg-gray-700 text-white px-4 rounded-lg font-semibold min-h-[48px] active:bg-gray-600"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-gray-900 rounded-xl p-3 mr-8 border border-red-500">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            {failedWrite ? (
              <>
                <p className="text-gray-400 text-sm mb-2">
                  Your objectives may or may not have changed. Check the list before trying again.
                </p>
                <button
                  onClick={reset}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold min-h-[44px]"
                >
                  Start over
                </button>
              </>
            ) : (
              <button
                onClick={handleRetry}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold min-h-[44px]"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-20 left-0 right-0 p-3 bg-gray-950 border-t border-gray-800">
        {starter && (
          <div className="flex items-center gap-2 mb-2 bg-gray-800 border border-purple-500 rounded-lg px-3 py-2">
            <p className="flex-1 text-sm text-purple-300 font-semibold">{starter.label}</p>
            <button
              onClick={() => setStarter(null)}
              aria-label="Remove starter"
              className="text-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              &times;
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={actions.length > 0}
            placeholder={
              actions.length ? 'Answer the question above first'
                : starter ? 'Add anything specific? Optional'
                : 'Ask anything...'
            }
            className="flex-1 bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500 min-h-[48px] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !starter) || pending || actions.length > 0}
            className="bg-purple-600 text-white px-5 rounded-lg font-semibold min-h-[48px] active:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
