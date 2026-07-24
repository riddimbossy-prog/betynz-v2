let running = false;

export function setPipelineRunning(value: boolean) {
  running = value;
}

export function isPipelineRunning() {
  return running;
}
