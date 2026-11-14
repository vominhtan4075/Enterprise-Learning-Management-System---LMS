'use client';

import { useEffect, useState } from 'react';
import {
  getAccountLockState,
  type AccountLockState,
} from '../../lib/api-client';

export function AccountStatusBadge() {
  const [state, setState] = useState<AccountLockState>('unlocked');

  useEffect(() => {
    const syncState = () => setState(getAccountLockState());

    syncState();
    window.addEventListener('storage', syncState);

    return () => {
      window.removeEventListener('storage', syncState);
    };
  }, []);

  const isLocked = state === 'locked';

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold',
        isLocked
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          isLocked ? 'bg-red-500' : 'bg-emerald-500',
        ].join(' ')}
      />
      {isLocked ? 'Locked' : 'Unlocked'}
    </span>
  );
}
