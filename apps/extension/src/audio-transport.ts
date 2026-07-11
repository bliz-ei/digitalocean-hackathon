import type {AudioChunkMetadata, ClassificationResult, VerdictDraft, WsEnvelope} from "@verity/contracts";

type EventHandler = (event: WsEnvelope) => void | Promise<void>;
type SocketFactory = (url: string) => WebSocket;

export class AudioTransport {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private messageSequence = 0;
  private chunkSequence = 0;
  private stopped = false;
  private disconnectedAt?: number;
  private readonly chunks = new Map<number, {metadata: AudioChunkMetadata; body: ArrayBuffer}>();

  constructor(
    private readonly url: string,
    private readonly streamId: string,
    private readonly dispatchMode: "client"|"server",
    private readonly onEvent: EventHandler,
    private readonly createSocket: SocketFactory = value => new WebSocket(value),
    private readonly maxChunks = 12,
    private readonly sampleRate = 48_000,
    private readonly channels = 1,
  ) {}

  connect(): void {
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      this.send("start_live", {stream_id:this.streamId, dispatch_mode:this.dispatchMode});
      for (const chunk of this.chunks.values()) this.sendAudio(chunk.metadata, chunk.body);
      this.heartbeatTimer = globalThis.setInterval(() => this.send("heartbeat", {}), 10_000);
    };
    socket.onmessage = event => void this.receive(JSON.parse(String(event.data)) as WsEnvelope);
    socket.onclose = () => this.reconnect();
    socket.onerror = () => socket.close();
  }

  async enqueue(blob: Blob, capturedAtMs: number, durationMs=1_000): Promise<void> {
    const body = await blob.arrayBuffer();
    if (!body.byteLength) return;
    if (this.chunks.size >= this.maxChunks) throw new Error("Audio connection is too far behind; restart capture.");
    const chunkSequence = this.chunkSequence++;
    const metadata: AudioChunkMetadata = {
      stream_id:this.streamId,
      chunk_sequence:chunkSequence,
      captured_at_ms:capturedAtMs,
      duration_ms:durationMs,
      mime_type:blob.type || "audio/webm;codecs=opus",
      sample_rate:this.sampleRate,
      channels:this.channels,
      byte_length:body.byteLength,
    };
    this.chunks.set(chunkSequence, {metadata, body});
    if (this.socket?.readyState === WebSocket.OPEN) this.sendAudio(metadata, body);
  }

  sendClassification(result: ClassificationResult): void {
    this.send("classification_result", result);
  }

  sendVerdict(result: VerdictDraft): void {
    this.send("verdict_draft", result);
  }

  stop(): void {
    this.stopped = true;
    if (this.socket?.readyState === WebSocket.OPEN) this.send("stop_live", {});
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.socket?.close();
    this.chunks.clear();
  }

  get bufferedChunks(): number { return this.chunks.size; }

  private send(type: string, payload: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({type,schema_version:"2",session_id:this.sessionId,sequence:this.messageSequence++,payload}));
  }

  private sendAudio(metadata: AudioChunkMetadata, body: ArrayBuffer): void {
    this.send("audio_chunk", metadata);
    this.socket?.send(body);
  }

  private async receive(event: WsEnvelope): Promise<void> {
    if(["ack","audio_ack","heartbeat_ack","capture_state"].includes(event.type))this.disconnectedAt=undefined;
    if (event.type === "audio_ack") {
      const watermark = Number((event.payload as {watermark?:number}).watermark ?? -1);
      for (const sequence of this.chunks.keys()) if (sequence <= watermark) this.chunks.delete(sequence);
    }
    await this.onEvent(event);
  }

  private reconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.disconnectedAt??=Date.now();
    if(Date.now()-this.disconnectedAt>=10_000){
      this.stopped=true;
      void this.onEvent({type:"connection_failed",schema_version:"2",session_id:this.sessionId,sequence:this.messageSequence,payload:{reason:"retry_window_exhausted"}});
      return;
    }
    this.reconnectTimer = globalThis.setTimeout(() => { this.reconnectTimer=undefined; this.connect(); }, 750);
  }

  private get sessionId(): string {
    const match = this.url.match(/\/sessions\/([^/]+)\/stream/);
    if (!match) throw new Error("Invalid Verity stream URL");
    return decodeURIComponent(match[1]);
  }
}
