export function ConversationListSkeleton() {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-tertiary rounded animate-skeleton-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className="h-3 bg-surface-tertiary rounded animate-skeleton-pulse" style={{ width: `${30 + Math.random() * 20}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {[true, false, true, false, true].map((isUser, i) => (
        <div
          key={i}
          className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className={`w-8 h-8 rounded-full animate-skeleton-pulse ${isUser ? 'bg-accent-primary/30' : 'bg-surface-tertiary'}`} />
          <div className={`flex-1 max-w-xl ${isUser ? 'items-end' : ''}`}>
            <div
              className={`rounded-2xl p-4 animate-skeleton-pulse ${
                isUser ? 'bg-accent-primary/20' : 'bg-surface-secondary'
              }`}
            >
              <div className="space-y-2">
                <div className="h-3 bg-surface-tertiary rounded" style={{ width: `${40 + Math.random() * 50}%` }} />
                <div className="h-3 bg-surface-tertiary rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                <div className="h-3 bg-surface-tertiary rounded" style={{ width: `${30 + Math.random() * 20}%` }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
