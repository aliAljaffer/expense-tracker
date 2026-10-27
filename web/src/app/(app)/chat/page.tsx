import type { Metadata } from "next";
import { ChatScreen } from "@/components/features/chat/ChatScreen";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default function ChatPage() {
  return <ChatScreen />;
}
