import {afterEach,describe,expect,it,vi} from "vitest";
import {AudioTransport} from "./audio-transport";

class FakeSocket {
  static OPEN=1;
  readyState=0;
  binaryType="";
  sent:unknown[]=[];
  onopen:()=>void=()=>undefined;
  onmessage:(event:{data:string})=>void=()=>undefined;
  onclose:()=>void=()=>undefined;
  onerror:()=>void=()=>undefined;
  send(value:unknown){this.sent.push(value)}
  open(){this.readyState=1;this.onopen()}
  close(){this.readyState=3;this.onclose()}
  message(value:unknown){this.onmessage({data:JSON.stringify(value)})}
}

describe("audio transport",()=>{
  afterEach(()=>vi.useRealTimers());

  it("buffers, acknowledges, and replays only unacknowledged chunks",async()=>{
    vi.useFakeTimers();
    Object.assign(globalThis,{WebSocket:FakeSocket});
    const sockets:FakeSocket[]=[];
    const transport=new AudioTransport(
      "ws://localhost/v1/sessions/session/stream?credential=x","stream","server",()=>undefined,
      (()=>{const socket=new FakeSocket();sockets.push(socket);return socket as unknown as WebSocket}),
    );
    transport.connect();sockets[0].open();
    await transport.enqueue(new Blob(["one"],{type:"audio/webm;codecs=opus"}),0);
    await transport.enqueue(new Blob(["two"],{type:"audio/webm;codecs=opus"}),1000);
    expect(transport.bufferedChunks).toBe(2);
    sockets[0].message({type:"audio_ack",schema_version:"2",session_id:"session",sequence:2,payload:{watermark:0}});
    await Promise.resolve();
    expect(transport.bufferedChunks).toBe(1);
    sockets[0].close();await vi.advanceTimersByTimeAsync(750);sockets[1].open();
    expect(sockets[1].sent.filter(value=>value instanceof ArrayBuffer)).toHaveLength(1);
    transport.stop();
  });

  it("fails before memory can grow without bound",async()=>{
    Object.assign(globalThis,{WebSocket:FakeSocket});
    const transport=new AudioTransport("ws://localhost/v1/sessions/session/stream","stream","server",()=>undefined,()=>new FakeSocket() as unknown as WebSocket,1);
    await transport.enqueue(new Blob(["one"],{type:"audio/webm"}),0);
    await expect(transport.enqueue(new Blob(["two"],{type:"audio/webm"}),1000)).rejects.toThrow("restart capture");
    transport.stop();
  });
});
