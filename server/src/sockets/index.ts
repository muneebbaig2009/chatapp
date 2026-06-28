import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import * as chatService from "../services/chat.service.js";
import * as callService from "../services/call.service.js";

interface SocketUser {
  userId: string;
}

// Track which users are connected (userId -> set of socket ids)
const online = new Map<string, Set<string>>();

interface ActiveCall {
  callId: string;
  callerId: string;
  calleeId: string;
  answered: boolean;
  startedAt: Date | null;
}
// Correlates the stateless signaling events below (which only carry
// {toUserId}) with the Call DB row. Keyed by EITHER participant's userId;
// both keys point to the same object so mutating it once (e.g. on accept)
// is visible from either side's lookup.
const activeCalls = new Map<string, ActiveCall>();

function clearActiveCall(entry: ActiveCall) {
  activeCalls.delete(entry.callerId);
  activeCalls.delete(entry.calleeId);
}

let ioInstance: Server | null = null;

// Lets REST controllers (e.g. group membership changes) emit to personal
// rooms without owning the Server instance themselves.
export function getIO(): Server {
  if (!ioInstance) throw new Error("Socket.io has not been initialized yet");
  return ioInstance;
}

export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });
  ioInstance = io;

  // Finalizes whichever call `byUserId` is currently in, used by both an
  // explicit call:end and a disconnect mid-call. If the call was never
  // answered, the caller cancelling vs. the callee disconnecting/declining
  // map to different statuses; an already-answered call just gets its
  // duration recorded. No-ops if there's no matching active call (e.g. a
  // duplicate/late event, or the other side already finalized it first).
  async function finalizeActiveCall(byUserId: string) {
    const entry = activeCalls.get(byUserId);
    if (!entry) return;
    clearActiveCall(entry);
    const finalCall =
      entry.answered && entry.startedAt
        ? await callService.finalizeAnswered(entry.callId, entry.startedAt)
        : byUserId === entry.callerId
          ? await callService.markCancelled(entry.callId)
          : await callService.markRejected(entry.callId);
    io.to(`user:${entry.callerId}`).emit("call:logged", callService.toCallLogEntry(finalCall, entry.callerId));
    io.to(`user:${entry.calleeId}`).emit("call:logged", callService.toCallLogEntry(finalCall, entry.calleeId));
  }

  // Authenticate every socket connection using the access token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No token"));
    try {
      const { userId } = verifyAccessToken(token);
      (socket.data as SocketUser).userId = userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId } = socket.data as SocketUser;

    // Mark online
    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId)!.add(socket.id);
    await prisma.user.update({ where: { id: userId }, data: { isOnline: true } });
    socket.broadcast.emit("presence:update", { userId, isOnline: true });
    socket.join(`user:${userId}`);

    // Join a room per chat so we can target events
    socket.on("chat:join", (chatId: string) => socket.join(`chat:${chatId}`));
    socket.on("chat:leave", (chatId: string) => socket.leave(`chat:${chatId}`));

    // Send a message
    socket.on("message:send", async (payload, ack) => {
      try {
        const msg = await chatService.createMessage(userId, payload.chatId, payload);
        // Notify every member of the chat in their personal room, so the
        // message arrives even if they haven't opened this chat yet.
        const members = await chatService.memberIds(payload.chatId);
        for (const memberId of members) {
          io.to(`user:${memberId}`).emit("message:new", msg);
        }
        ack?.({ ok: true, message: msg });
      } catch (e: any) {
        ack?.({ ok: false, error: e.message });
      }
    });

    // Typing indicator
    socket.on("typing:start", (chatId: string) =>
      socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId })
    );
    socket.on("typing:stop", (chatId: string) =>
      socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId })
    );

    // Read receipt
    socket.on("message:read", async ({ chatId, messageId }) => {
      await prisma.messageReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId, status: "READ" },
        update: { status: "READ" },
      });
      // Notify all members in their personal rooms so the sender sees the tick
      // flip even if they don't have the chat open.
      const members = await chatService.memberIds(chatId);
      for (const memberId of members) {
        io.to(`user:${memberId}`).emit("message:read", { chatId, messageId, userId });
      }
    });

    // Reaction
    socket.on("reaction:add", async ({ chatId, messageId, emoji }) => {
      const reaction = await prisma.reaction.upsert({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
        create: { messageId, userId, emoji },
        update: {},
      });
      io.to(`chat:${chatId}`).emit("reaction:add", reaction);
    });

    // WebRTC call signaling — this server only relays offers/answers/ICE
    // candidates between the two participants' personal rooms; it never
    // inspects media itself. It does persist a Call row per attempt so
    // history/missed-call tracking works (see call.service.ts).
    socket.on("call:initiate", async ({ toUserId, chatId, callType, offer }) => {
      await chatService.assertMember(userId, chatId);
      const prismaCallType = callType === "video" ? "VIDEO" : "VOICE";
      const call = await callService.createPendingCall(userId, toUserId, chatId ?? null, prismaCallType);

      if (!online.has(toUserId)) {
        const missed = await callService.markMissed(call.id);
        socket.emit("call:logged", callService.toCallLogEntry(missed, userId));
        socket.emit("call:rejected", { fromUserId: toUserId, reason: "offline" });
        return;
      }

      const entry: ActiveCall = { callId: call.id, callerId: userId, calleeId: toUserId, answered: false, startedAt: null };
      activeCalls.set(userId, entry);
      activeCalls.set(toUserId, entry);

      const caller = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, avatarUrl: true },
      });
      io.to(`user:${toUserId}`).emit("call:incoming", {
        chatId,
        callType,
        offer,
        caller: caller ?? { id: userId, displayName: "Unknown", avatarUrl: null },
      });
    });

    socket.on("call:accept", async ({ toUserId, answer }) => {
      const entry = activeCalls.get(userId);
      if (entry) {
        const startedAt = new Date();
        entry.answered = true;
        entry.startedAt = startedAt;
        await callService.markAnswered(entry.callId, startedAt);
      }
      io.to(`user:${toUserId}`).emit("call:accepted", { fromUserId: userId, answer });
    });

    socket.on("call:reject", async ({ toUserId }) => {
      const entry = activeCalls.get(userId);
      if (entry) {
        clearActiveCall(entry);
        const rejected = await callService.markRejected(entry.callId);
        io.to(`user:${entry.callerId}`).emit("call:logged", callService.toCallLogEntry(rejected, entry.callerId));
        io.to(`user:${entry.calleeId}`).emit("call:logged", callService.toCallLogEntry(rejected, entry.calleeId));
      }
      io.to(`user:${toUserId}`).emit("call:rejected", { fromUserId: userId });
    });

    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit("call:ice-candidate", { fromUserId: userId, candidate });
    });

    socket.on("call:end", async ({ toUserId }) => {
      await finalizeActiveCall(userId);
      io.to(`user:${toUserId}`).emit("call:ended", { fromUserId: userId });
    });

    socket.on("disconnect", async () => {
      const set = online.get(userId);
      set?.delete(socket.id);
      if (!set || set.size === 0) {
        online.delete(userId);
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: new Date() },
        });
        socket.broadcast.emit("presence:update", { userId, isOnline: false });

        // If they were mid-call, finalize it so the activeCalls entry
        // doesn't leak and the other side's history stays accurate.
        const entry = activeCalls.get(userId);
        const otherId = entry ? (entry.callerId === userId ? entry.calleeId : entry.callerId) : null;
        await finalizeActiveCall(userId);
        if (otherId) io.to(`user:${otherId}`).emit("call:ended", { fromUserId: userId });
      }
    });
  });

  return io;
}
