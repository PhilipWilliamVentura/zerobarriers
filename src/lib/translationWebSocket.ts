// src/lib/translationWebSocket.ts
export interface TranslationMessage {
  type: 'audio' | 'video' | 'subtitle' | 'error';
  data: any;
  timestamp: number;
}

export class TranslationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor(
    private url: string,
    private onMessage: (message: TranslationMessage) => void,
    private onConnectionChange: (connected: boolean) => void
  ) {}

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('Translation WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.onConnectionChange(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: TranslationMessage = JSON.parse(event.data);
            this.onMessage(message);
          } catch (error) {
            console.error('Error parsing translation message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('Translation WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          this.onConnectionChange(false);
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('Translation WebSocket error:', error);
          this.isConnecting = false;
          this.onConnectionChange(false);
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect().catch(console.error);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  sendAudioData(audioBuffer: ArrayBuffer, sampleRate: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: TranslationMessage = {
        type: 'audio',
        data: {
          audio: Array.from(new Uint8Array(audioBuffer)),
          sampleRate: sampleRate
        },
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  sendVideoFrame(frameData: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: TranslationMessage = {
        type: 'video',
        data: {
          frame: frameData
        },
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}