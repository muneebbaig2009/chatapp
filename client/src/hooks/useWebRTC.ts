import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useSocketRef, useSocketVersion } from "./SocketContext";
import { startRingSound, stopRingSound } from "../utils/sound";
import type { CallPeer, CallType } from "../types";

type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "active";

interface CallState {
  status: CallStatus;
  callType: CallType | null;
  chatId: string | null;
  peer: CallPeer | null;
  isCaller: boolean;
}

const idleState: CallState = {
  status: "idle",
  callType: null,
  chatId: null,
  peer: null,
  isCaller: false,
};

// Manages a single 1-to-1 RTCPeerConnection: fetches TURN/STUN credentials,
// captures local media, exchanges offer/answer/ICE candidates over the
// existing socket signaling events, and exposes the streams + call controls
// that the call UI components render.
export function useWebRTC() {
  const socketRef = useSocketRef();
  const socketVersion = useSocketVersion();

  const [callState, setCallState] = useState<CallState>(idleState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  const cleanup = useCallback(() => {
    stopRingSound();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState(idleState);
  }, []);

  async function fetchIceServers(): Promise<RTCIceServer[]> {
    try {
      const { data } = await api.get<RTCIceServer[]>("/calls/ice-servers");
      return data;
    } catch {
      return [];
    }
  }

  async function getLocalMedia(callType: CallType): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  function flushPendingCandidates(pc: RTCPeerConnection) {
    for (const candidate of pendingCandidatesRef.current) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
    pendingCandidatesRef.current = [];
  }

  function createPeerConnection(toUserId: string, iceServers: RTCIceServer[]): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("call:ice-candidate", {
          toUserId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? null);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState((s) => (s.status === "idle" ? s : { ...s, status: "active" }));
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        if (callStateRef.current.status !== "idle") cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }

  const startCall = useCallback(async (chatId: string, peer: CallPeer, callType: CallType) => {
    if (callStateRef.current.status !== "idle") return;
    setCallState({ status: "outgoing", callType, chatId, peer, isCaller: true });
    startRingSound(); // ringback while waiting for the callee to pick up
    try {
      const [stream, iceServers] = await Promise.all([getLocalMedia(callType), fetchIceServers()]);
      const pc = createPeerConnection(peer.id, iceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("call:initiate", { toUserId: peer.id, chatId, callType, offer });
    } catch {
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);

  const rejectCall = useCallback(() => {
    const peer = callStateRef.current.peer;
    if (peer) socketRef.current?.emit("call:reject", { toUserId: peer.id });
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);

  const acceptCall = useCallback(async () => {
    const { chatId, callType, peer } = callStateRef.current;
    if (!peer || !callType || !chatId) return;
    setCallState((s) => ({ ...s, status: "connecting" }));
    stopRingSound();
    try {
      const [stream, iceServers] = await Promise.all([getLocalMedia(callType), fetchIceServers()]);
      const pc = createPeerConnection(peer.id, iceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      }
      flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit("call:accept", { toUserId: peer.id, answer });
    } catch {
      rejectCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectCall]);

  const hangUp = useCallback(() => {
    const { peer, status } = callStateRef.current;
    if (peer && status !== "idle") socketRef.current?.emit("call:end", { toUserId: peer.id });
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted((muted) => {
      const next = !muted;
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setIsCameraOff((off) => {
      const next = !off;
      localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  // Bind signaling listeners to whichever socket is currently live, and
  // rebind whenever socketVersion changes (e.g. the socket was recreated
  // after a token refresh) so we never listen on a stale, dead socket.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onIncoming({
      chatId, callType, offer, caller,
    }: { chatId: string; callType: CallType; offer: RTCSessionDescriptionInit; caller: CallPeer }) {
      if (callStateRef.current.status !== "idle") {
        socket?.emit("call:reject", { toUserId: caller.id });
        return;
      }
      pendingOfferRef.current = offer;
      setCallState({ status: "incoming", callType, chatId, peer: caller, isCaller: false });
      startRingSound();
    }

    async function onAccepted({ answer }: { answer: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      flushPendingCandidates(pc);
      setCallState((s) => (s.status === "idle" ? s : { ...s, status: "connecting" }));
      stopRingSound();
    }

    function onRejected() {
      cleanup();
    }

    function onIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    function onEnded() {
      cleanup();
    }

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:ended", onEnded);
    };
  }, [socketRef, socketVersion, cleanup]);

  return {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}
