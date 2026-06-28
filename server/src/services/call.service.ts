import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import type { Call, CallType } from "@prisma/client";

// Metered's TURN credentials endpoint returns the iceServers array directly.
export async function fetchIceServers(): Promise<unknown[]> {
  if (!env.meteredApiKey || !env.meteredDomain) {
    throw new ApiError(500, "TURN credentials are not configured");
  }
  const url = `https://${env.meteredDomain}/api/v1/turn/credentials?apiKey=${env.meteredApiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, "Failed to fetch ICE servers");
  return res.json();
}

const callUserSelect = { id: true, displayName: true, avatarUrl: true } as const;
const callInclude = {
  caller: { select: callUserSelect },
  callee: { select: callUserSelect },
};

type CallWithUsers = Call & {
  caller: { id: string; displayName: string; avatarUrl: string | null };
  callee: { id: string; displayName: string; avatarUrl: string | null };
};

// createdAt = when the call was placed (shown for every entry, including
// unanswered ones). startedAt = when it was answered (used only for
// duration math) — never used for the displayed timestamp.
export function toCallLogEntry(call: CallWithUsers, viewerId: string) {
  const isOutgoing = call.callerId === viewerId;
  const other = isOutgoing ? call.callee : call.caller;
  return {
    id: call.id,
    chatId: call.chatId,
    callType: call.callType,
    status: call.status,
    direction: isOutgoing ? ("outgoing" as const) : ("incoming" as const),
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    createdAt: call.createdAt,
    otherUser: other,
  };
}

export async function createPendingCall(
  callerId: string,
  calleeId: string,
  chatId: string | null,
  callType: CallType,
): Promise<CallWithUsers> {
  return prisma.call.create({
    data: { callerId, calleeId, chatId, callType },
    include: callInclude,
  });
}

export async function markMissed(callId: string): Promise<CallWithUsers> {
  return prisma.call.update({
    where: { id: callId },
    data: { status: "MISSED", endedAt: new Date() },
    include: callInclude,
  });
}

export async function markAnswered(callId: string, startedAt: Date): Promise<CallWithUsers> {
  return prisma.call.update({
    where: { id: callId },
    data: { status: "ANSWERED", startedAt },
    include: callInclude,
  });
}

export async function markRejected(callId: string): Promise<CallWithUsers> {
  return prisma.call.update({
    where: { id: callId },
    data: { status: "REJECTED", endedAt: new Date() },
    include: callInclude,
  });
}

export async function markCancelled(callId: string): Promise<CallWithUsers> {
  return prisma.call.update({
    where: { id: callId },
    data: { status: "CANCELLED", endedAt: new Date() },
    include: callInclude,
  });
}

export async function finalizeAnswered(callId: string, startedAt: Date): Promise<CallWithUsers> {
  const endedAt = new Date();
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  return prisma.call.update({
    where: { id: callId },
    data: { endedAt, durationSeconds },
    include: callInclude,
  });
}

export async function getCallHistory(userId: string) {
  const calls = await prisma.call.findMany({
    where: { OR: [{ callerId: userId }, { calleeId: userId }] },
    include: callInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return calls.map((call) => toCallLogEntry(call, userId));
}
