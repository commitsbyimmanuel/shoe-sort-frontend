// src/hooks/useUploadQueue.ts
// React hook for the upload queue state

import { useCallback, useEffect, useState } from "react";
import { QueueState, uploadQueue } from "../lib/uploadQueue";

const initialState: QueueState = {
  jobs: [],
  pending: 0,
  uploading: 0,
  completed: 0,
  failed: 0,
  isProcessing: false,
};

export function useUploadQueue() {
  const [state, setState] = useState<QueueState>(initialState);

  useEffect(() => {
    // Get initial state
    setState(uploadQueue.getState());

    // Subscribe to updates
    const unsubscribe = uploadQueue.subscribe(setState);
    return unsubscribe;
  }, []);

  const enqueue = useCallback(
    (uri: string, locationInfo: string, clientId: string) => {
      return uploadQueue.enqueue(uri, locationInfo, clientId);
    },
    []
  );

  const clearCompleted = useCallback(() => {
    uploadQueue.clearCompleted();
  }, []);

  const retryFailed = useCallback(() => {
    uploadQueue.retryFailed();
  }, []);

  const isAllDone = useCallback(() => {
    return uploadQueue.isAllDone();
  }, []);

  return {
    ...state,
    enqueue,
    clearCompleted,
    retryFailed,
    isAllDone,
    // Convenience: total in-flight (pending + uploading)
    inFlight: state.pending + state.uploading,
    // Convenience: has any work been done or queued
    hasActivity: state.completed > 0 || state.pending > 0 || state.uploading > 0,
  };
}
