import { Debuggee, Debugger_Network_requestIntercepted } from "./debuggee";
import { Intercepted, FetchIntercepted, RequestIntercepted } from "./request";

export abstract class Interception {
  debuggee: Debuggee;
  protected constructor(dbg: Debuggee) {
    this.debuggee = dbg;
  }

  abstract async onRequestInternal(listener: (req: Intercepted) => void): Promise<void>;

  async onRequest(listener: (req: Intercepted) => void): Promise<void> {
    return this.onRequestInternal(listener);
  }

  abstract async onResponseInternal(listener: (res: Intercepted) => void): Promise<void>;

  async onResponse(listener: (res: Intercepted) => void): Promise<void> {
    return this.onResponseInternal(listener);
  }

  abstract async captureInternal(pattern: string): Promise<void>;

  async capture(pattern: string): Promise<void> {
    return this.captureInternal(pattern);
  }

  static build(dbg: Debuggee): Interception {
    return new FetchInterception(dbg);
    // return new RequestInterception(dbg);
  }

}

class RequestInterception extends Interception {
  async captureInternal(pattern: string) {
    await this.debuggee.sendCommand('Network.setCacheDisabled', { cacheDisabled: true });
    await this.debuggee.sendCommand('Network.setRequestInterception', {
      patterns: [
        { urlPattern: pattern, interceptionStage: 'Request' },
        { urlPattern: pattern, interceptionStage: 'HeadersReceived' },
      ]
    });
  }

  async onRequestInternal(listener: (res: Intercepted) => void) {
    return this.debuggee.on('Network.requestIntercepted', (params: Debugger_Network_requestIntercepted) => {
      if (params.responseStatusCode) return;
      listener(new RequestIntercepted(this.debuggee, params));
    });
  }

  async onResponseInternal(listener: (res: Intercepted) => void) {
    return this.debuggee.on('Network.requestIntercepted', params => {
      if (params.responseStatusCode) {
        listener(new RequestIntercepted(this.debuggee, params));
      }
    });
  }
}

class FetchInterception extends Interception {
  async captureInternal(pattern: string) {
    await this.debuggee.sendCommand('Fetch.enable', {
      patterns: [
        { urlPattern: pattern, interceptionStage: 'Request' },
        { urlPattern: pattern, interceptionStage: 'Response' },
      ]
    });
  }

  async onRequestInternal(listener: (req: Intercepted) => void) {
    return this.debuggee.on('Fetch.requestPaused', params => {
      if (params.responseStatusCode) return;
      listener(new FetchIntercepted(this.debuggee, params));
    });
  }

  async onResponseInternal(listener: (res: Intercepted) => void) {
    return this.debuggee.on('Fetch.requestPaused', params => {
      if (params.responseStatusCode) {
        listener(new FetchIntercepted(this.debuggee, params));
      }
    });
  }
}

