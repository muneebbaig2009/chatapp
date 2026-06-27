import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Chat, Message } from "../../types";

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>;  // chatId -> messages
  typing: Record<string, string[]>;     // chatId -> userIds typing
  onlineUsers: Record<string, boolean>; // userId -> online
}

const initialState: ChatState = {
  chats: [],
  activeChatId: null,
  messages: {},
  typing: {},
  onlineUsers: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChats(state, action: PayloadAction<Chat[]>) {
      state.chats = action.payload;
    },
    upsertChat(state, action: PayloadAction<Chat>) {
      const i = state.chats.findIndex((c) => c.id === action.payload.id);
      if (i >= 0) state.chats[i] = action.payload;
      else state.chats.unshift(action.payload);
    },
    removeChat(state, action: PayloadAction<string>) {
      state.chats = state.chats.filter((c) => c.id !== action.payload);
      delete state.messages[action.payload];
      delete state.typing[action.payload];
      if (state.activeChatId === action.payload) state.activeChatId = null;
    },
    setActiveChat(state, action: PayloadAction<string | null>) {
      state.activeChatId = action.payload;
    },
    setMessages(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      state.messages[action.payload.chatId] = action.payload.messages;
    },
    addMessage(state, action: PayloadAction<Message>) {
      const m = action.payload;
      const list = state.messages[m.chatId] ?? [];
      if (!list.some((x) => x.id === m.id)) {
        state.messages[m.chatId] = [...list, m];
      }
    },
    setTyping(state, action: PayloadAction<{ chatId: string; userId: string; typing: boolean }>) {
      const { chatId, userId, typing } = action.payload;
      const cur = state.typing[chatId] ?? [];
      state.typing[chatId] = typing
        ? Array.from(new Set([...cur, userId]))
        : cur.filter((u) => u !== userId);
    },
    setPresence(state, action: PayloadAction<{ userId: string; isOnline: boolean }>) {
      state.onlineUsers[action.payload.userId] = action.payload.isOnline;
    },
    markRead(state, action: PayloadAction<{ chatId: string; messageId: string; userId: string }>) {
      const { chatId, messageId, userId } = action.payload;
      const list = state.messages[chatId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.receipts = msg.receipts ?? [];
      if (!msg.receipts.some((r) => r.userId === userId)) {
        msg.receipts.push({ userId, status: "READ" });
      }
    },
  },
});

export const {
  setChats, upsertChat, removeChat, setActiveChat, setMessages,
  addMessage, setTyping, setPresence, markRead,
} = chatSlice.actions;
export default chatSlice.reducer;
