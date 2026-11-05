import * as Network from 'expo-network';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { announce } from '@/lib/announce';
import { getSupabase } from '@/lib/supabase';
import { useRecords } from '@/state/records-context';
import { downloadMessage, downloadPublicCopy, type DownloadOutcome } from '@/sync/public-copy';
import { supabasePublicCopyApi } from '@/sync/supabase-public-api';

// Decides when to download the plant info that visitors read (src/sync/public-copy.ts does the
// download). Visitors need it to scan tags with no signal, and staff scans fall back to it, so it
// runs in both modes, but not until someone has picked one. Nobody has to be signed in. Like
// syncing, it only runs while the app is open, which docs/sync-design.md lists under Known limits.

/** How often to download again while the app is open, so new records show up without a restart. */
const UPDATE_EVERY_MS = 10 * 60 * 1000;

/**
 * A download that worked this recently is new enough, so the automatic ones wait. Patchy signal
 * would otherwise start a new one every time it came back.
 */
const FRESH_FOR_MS = 5 * 60 * 1000;

type PublicCopyContextValue = {
  /** Downloads the plant info because someone asked for it, then says how it went. */
  updateNow: () => Promise<void>;
  running: boolean;
  /** How the last download someone asked for went, for showing near the Update now button. */
  message: string | null;
  /** How the last download went, or null if none has finished since the app opened. */
  lastOutcome: DownloadOutcome | null;
  /** False when this build has no server to download from. */
  canUpdate: boolean;
};

const PublicCopyContext = createContext<PublicCopyContextValue | null>(null);

export function PublicCopyProvider({ children }: { children: ReactNode }) {
  const { mode, publicCopyAt, replacePublicCopy } = useRecords();
  const hasMode = mode !== null;
  const canUpdate = Boolean(getSupabase());

  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<DownloadOutcome | null>(null);
  // What the last download came to is no use once the phone switches to visitor or staff.
  const [messageMode, setMessageMode] = useState(mode);
  if (messageMode !== mode) {
    setMessageMode(mode);
    setMessage(null);
  }
  // One download at a time, and two quick taps can land before the button shows as disabled.
  const busy = useRef(false);
  // Something asked for a download during one, so go round again once it's done.
  const again = useRef(false);
  /** When a download last worked (from Date.now()), or null if none has since the app opened. */
  const lastWorked = useRef<number | null>(null);
  // The same as lastOutcome, for the network listener. The listener keeps the values from the
  // render it was made in, so it can't read lastOutcome itself.
  const outcomeRef = useRef<DownloadOutcome | null>(null);

  async function run(manual: boolean) {
    const supabase = getSupabase();
    if (!supabase || !hasMode || busy.current) {
      return;
    }
    busy.current = true;
    setRunning(true);
    try {
      const hadCopy = publicCopyAt !== null;
      const outcome = await downloadPublicCopy(supabasePublicCopyApi(supabase), {
        replacePublicCopy,
      });
      outcomeRef.current = outcome;
      setLastOutcome(outcome);
      if (outcome === 'done') {
        lastWorked.current = Date.now();
      }
      if (manual) {
        const text = downloadMessage(outcome, hadCopy);
        setMessage(text);
        announce(text);
      } else if (outcome === 'done') {
        // Whatever it said before is out of date now.
        setMessage(null);
      }
    } finally {
      busy.current = false;
      setRunning(false);
    }
    if (again.current) {
      again.current = false;
      setTimeout(() => autoRef.current(), 0);
    }
  }

  function auto() {
    if (busy.current) {
      again.current = true;
      return;
    }
    if (lastWorked.current !== null && Date.now() - lastWorked.current < FRESH_FOR_MS) {
      return;
    }
    // One that doesn't work says nothing, because the time it last worked is already on screen.
    run(false).catch((error: unknown) => {
      console.warn("Couldn't update the plant info.", error);
    });
  }

  // The listeners below stay the same once someone has picked who uses the phone, so they call
  // whichever version of auto came from the latest render.
  const autoRef = useRef(auto);
  useEffect(() => {
    autoRef.current = auto;
  });

  // When the app opens, and when someone picks who uses the phone for the first time.
  useEffect(() => {
    if (hasMode && canUpdate) {
      autoRef.current();
    }
  }, [hasMode, canUpdate]);

  // When the app comes back to the front, and when signal comes back.
  useEffect(() => {
    if (!hasMode || !canUpdate) {
      return;
    }
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        autoRef.current();
      }
    });
    let connected: boolean | undefined;
    const network = Network.addNetworkStateListener(({ isConnected }) => {
      // Android says nothing when the app opens with no signal, so the first thing it says can be
      // that signal is back. That's why a last download that found no signal counts as well.
      if (isConnected && (connected === false || outcomeRef.current === 'offline')) {
        autoRef.current();
      }
      connected = isConnected;
    });
    return () => {
      appState.remove();
      network.remove();
    };
  }, [hasMode, canUpdate]);

  // Every 10 minutes, so records staff add show up while the app stays open.
  useEffect(() => {
    if (!hasMode || !canUpdate) {
      return;
    }
    const timer = setInterval(() => autoRef.current(), UPDATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [hasMode, canUpdate]);

  function updateNow() {
    return run(true).catch((error: unknown) => {
      console.warn("Couldn't update the plant info.", error);
    });
  }

  return (
    <PublicCopyContext value={{ updateNow, running, message, lastOutcome, canUpdate }}>
      {children}
    </PublicCopyContext>
  );
}

export function usePublicCopy() {
  const context = use(PublicCopyContext);
  if (!context) {
    throw new Error('usePublicCopy has to be used inside PublicCopyProvider.');
  }
  return context;
}
