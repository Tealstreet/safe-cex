import pako from 'pako';

export interface WorkerPayload {
  op: string;
  data?: any;
  wsId: string;
}

export class Event {
  target: any;
  type: string;
  constructor(type: string, target: any) {
    this.target = target;
    this.type = type;
  }
}

export class ErrorEvent extends Event {
  message: string;
  error: Error;
  constructor(error: Error, target: any) {
    super('error', target);
    this.message = error.message;
    this.error = error;
  }
}

export class CloseEvent extends Event {
  code: number;
  reason: string;
  wasClean = true;
  constructor(code = 1000, reason = '', target: any) {
    super('close', target);
    this.code = code;
    this.reason = reason;
  }
}

const ctx: Worker = self as any;

class WebsocketProxy {
  private _ws: WebSocket | undefined;
  private _isBingX = false;

  connect(url: string) {
    this._ws = new WebSocket(url);
    if (url.toString().includes('we-api')) {
      this._ws.binaryType = 'arraybuffer';
      this._isBingX = true;
    }

    this._ws.onopen = (event: Event) => {
      ctx.postMessage({
        op: 'open',
        data: {
          ...event,
        },
      });
    };

    this._ws.onclose = (event: CloseEvent) => {
      ctx.postMessage({
        op: 'close',
        data: {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        },
      });
    };

    this._ws.onmessage = (event: MessageEvent) => {
      if (this._isBingX) {
        ctx.postMessage({
          op: 'message',
          data: pako.inflate(new Uint8Array(event.data), { to: 'string' }),
        });
      } else {
        ctx.postMessage({
          op: 'message',
          data: event.data,
        });
      }
    };

    this._ws.onerror = (event: Event) => {
      ctx.postMessage({
        op: 'error',
        data: {
          message: `${event}`,
          error: `${event}`,
        },
      });
    };
  }

  send(message: string) {
    this._ws?.send(message);
  }

  close() {
    this._ws?.close();
  }
}

const websocketProxy = new WebsocketProxy();

self.addEventListener('message', (event: any) => {
  const payload = event.data as WorkerPayload;

  if (
    typeof websocketProxy[payload.op as 'close' | 'connect' | 'send'] ===
    'function'
  ) {
    websocketProxy[payload.op as 'close' | 'connect' | 'send'](payload.data);
  }
});

export default null;
