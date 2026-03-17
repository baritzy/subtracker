import { Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import type { GmailStatus } from '@/types';

interface Props {
  status: GmailStatus;
  syncing: boolean;
  syncResult: number | null;
  onConnect: () => void;
  onSync: () => void;
}

export function GmailSyncStatus({ status, syncing, syncResult, onConnect, onSync }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {status.connected ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <CheckCircle size={13} style={{ color: '#22c55e' }} />
            <span style={{ color: '#475569' }}>
              Gmail {status.last_synced_at ? `סונכרן ${formatTimeAgo(status.last_synced_at)}` : 'מחובר'}
            </span>
          </div>
          {syncResult !== null && syncResult > 0 && (
            <span style={{
              fontSize: '11px', background: 'rgba(99,102,241,0.2)', color: '#818cf8',
              padding: '2px 8px', borderRadius: '20px',
            }}>
              +{syncResult} נמצאו
            </span>
          )}
          <button
            onClick={onSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', cursor: syncing ? 'wait' : 'pointer',
              fontFamily: "'Heebo', sans-serif",
            }}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
          </button>
        </>
      ) : (
        <>
          <AlertCircle size={13} style={{ color: '#64748b' }} />
          <span style={{ fontSize: '12px', color: '#475569' }}>Gmail לא מחובר</span>
          <button
            onClick={onConnect}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8', cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
            }}
          >
            <Mail size={12} /> חבר Gmail
          </button>
        </>
      )}
    </div>
  );
}
