import { useState, useEffect } from 'react'
import { getSyncStatus, onSyncStatusChange, offSyncStatusChange, retryFailedWrites } from '../utils/storage'

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    background: '#1a1a2e',
    border: '1px solid #2e2e4e',
    borderRadius: '10px',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    minWidth: '200px',
    fontFamily: 'inherit',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  dotGreen: {
    background: '#27ae60',
  },
  dotRed: {
    background: '#e74c3c',
  },
  retryBtn: {
    marginLeft: '8px',
    background: '#c9a84c',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    flexShrink: 0,
  },
}

const spinKeyframes = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

export default function SyncIndicator() {
  const [status, setStatus] = useState(() => getSyncStatus())
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handleChange(newStatus) {
      setStatus(newStatus)
      setVisible(newStatus.pending > 0 || newStatus.offline || newStatus.failed > 0)
    }
    onSyncStatusChange(handleChange)
    return () => offSyncStatusChange(handleChange)
  }, [])

  // Auto-hide synced indicator after 3 seconds
  useEffect(() => {
    if (visible && !status.pending && !status.offline && status.synced > 0) {
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [visible, status])

  if (!visible) return null

  const isPending = status.pending > 0
  const isOffline = status.offline || status.failed > 0

  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={styles.container} role="status" aria-live="polite">
        {isPending ? (
          <>
            <span style={{ fontSize: '16px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>
            <span>Synchronisation...</span>
          </>
        ) : isOffline ? (
          <>
            <span style={{ ...styles.dot, ...styles.dotRed }} />
            <span>⚠️ Hors ligne — données sauvées localement</span>
            <button style={styles.retryBtn} onClick={retryFailedWrites}>
              Réessayer
            </button>
          </>
        ) : (
          <>
            <span style={{ ...styles.dot, ...styles.dotGreen }} />
            <span>✅ Synchronisé</span>
          </>
        )}
      </div>
    </>
  )
}
