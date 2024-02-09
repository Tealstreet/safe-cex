'use client';

import pako from 'pako';

import type { WorkerPayload } from './websocketWebworker';

export type Handler = ({ data }?: any) => void;
type ListenerType = 'close' | 'error' | 'message' | 'open';

export class WebsocketWorker {
  private _worker: Worker;
  private _usePako = false;
  private _messageHandlers: Partial<{ [key in ListenerType]: Handler[] }> = {};
  private _workerReadyState: number = WebSocket.CLOSED;

  constructor(url: string) {
    if (url.toString().includes('we-api')) {
      this._usePako = true;
    }
    this._worker = new Worker(new URL('./websocketWebworker', import.meta.url));
    this._worker.addEventListener(
      'message',
      ({ data }: { data: WorkerPayload }) => {
        switch (data.op) {
          case 'open':
            this._handleOpen(data.data);
            break;
          case 'close':
            this._handleClose(data.data);
            break;
          case 'message':
            this._handleMessage({
              data: `${data.data}`,
            } as MessageEvent);
            break;
          case 'error':
            this._handleError(data.data);
            break;
        }
      }
    );
    this._worker.postMessage({
      op: 'connect',
      data: url,
    });
  }

  get readyState() {
    return this._workerReadyState;
  }

  _handleOpen(_event: Event) {
    this._workerReadyState = WebSocket.OPEN;
    for (const handler of this._messageHandlers.open || []) {
      try {
        handler();
      } catch (e) {
        // Ignored
      }
    }
  }

  _handleClose(_event: CloseEvent) {
    this._workerReadyState = WebSocket.CLOSED;
    for (const handler of this._messageHandlers.close || []) {
      try {
        handler();
      } catch (e) {
        // Ignored
      }
    }
  }

  _handleMessage(event: MessageEvent) {
    if (this._usePako) {
      const data = pako.inflate(new Uint8Array(event.data), { to: 'string' });
      for (const handler of this._messageHandlers.message || []) {
        try {
          handler({ ...event, data });
        } catch (e) {
          // Ignored
        }
      }
    } else {
      for (const handler of this._messageHandlers.message || []) {
        try {
          handler({ ...event });
        } catch (e) {
          // Ignored
        }
      }
    }
  }

  _handleError(_event: ErrorEvent) {
    for (const handler of this._messageHandlers.error || []) {
      try {
        handler();
      } catch (e) {
        // Ignored
      }
    }
  }

  close() {
    this._workerReadyState = WebSocket.CLOSED;
    this._worker.postMessage({
      op: 'close',
    });
    this._worker.terminate();
  }

  send(data: string) {
    this._worker.postMessage({
      op: 'send',
      data,
    });
  }

  addEventListener(event: ListenerType, handler: Handler) {
    if (!Array.isArray(this._messageHandlers[event])) {
      this._messageHandlers[event] = [];
    }
    this._messageHandlers[event]!.push(handler);
  }

  removeEventListener(event: ListenerType, handler: Handler) {
    if (!Array.isArray(this._messageHandlers[event])) {
      this._messageHandlers[event] = [];
    }
    this._messageHandlers[event]! = this._messageHandlers[event]!.filter(
      (_handler) => _handler !== handler
    );
  }
}
