type SnapshotTask = () => void;

export interface SnapshotScheduler {
  schedule: (task: SnapshotTask) => void;
  flushNow: (task: SnapshotTask) => void;
  cancel: () => void;
}

export function createSnapshotScheduler(
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (handle: number) => void
): SnapshotScheduler {
  let frameHandle: number | null = null;
  let pendingTask: SnapshotTask | null = null;

  const runFrame = () => {
    frameHandle = null;
    const task = pendingTask;
    pendingTask = null;
    task?.();
  };

  return {
    schedule(task) {
      pendingTask = task;
      if (frameHandle != null) {
        return;
      }
      frameHandle = requestFrame(runFrame);
    },
    flushNow(task) {
      pendingTask = null;
      if (frameHandle != null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      task();
    },
    cancel() {
      pendingTask = null;
      if (frameHandle != null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
    },
  };
}
