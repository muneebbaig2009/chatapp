import { useAppSelector } from "../store/hooks";
import { Sidebar } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";

// On mobile: show sidebar OR chat window. On desktop: both side by side.
export function ChatPage() {
  const activeChatId = useAppSelector((s) => s.chat.activeChatId);
  return (
    <div className="h-full flex">
      <div className={`${activeChatId ? "hidden sm:flex" : "flex"} w-full sm:w-auto`}>
        <Sidebar />
      </div>
      <div className={`${activeChatId ? "flex" : "hidden sm:flex"} flex-1`}>
        <ChatWindow />
      </div>
    </div>
  );
}
