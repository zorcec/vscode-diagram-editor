declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };

let api: ReturnType<typeof acquireVsCodeApi> | null = null;

export function getVSCodeApi(): ReturnType<typeof acquireVsCodeApi> {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

export function postMessageToHost(msg: unknown): void {
  getVSCodeApi().postMessage(msg);
}
