export interface User {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  about?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "VOICE" | "FILE";
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  sender?: { id: string; displayName: string; avatarUrl: string | null };
  reactions?: Reaction[];
  replyTo?: { id: string; content: string | null; senderId: string } | null;
  receipts?: { userId: string; status: string }[];
}

export interface ChatMemberWithUser {
  id: string;
  userId: string;
  isAdmin: boolean;
  user: User;
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name: string | null;
  description?: string | null;
  iconUrl: string | null;
  members: ChatMemberWithUser[];
  messages?: Message[];
}
