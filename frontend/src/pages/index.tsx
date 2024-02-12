import { Button } from "@frontend/components/ui/button";
import { Textarea } from "@frontend/components/ui/textarea";
import useSocket from "@frontend/hooks/useSocket";
import { FormEvent, useEffect, useRef, useState } from "react";

const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated";
const NEW_MESSAGE_CHANNEL = "chat:new-message";

type Message = {
  message: string;
  id: string;
  createdAt: string;
  port: string;
};

export default function Home() {
  const [newMessage, setNewMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const socket = useSocket();
  const messageListRef = useRef<HTMLOListElement | null>(null);

  function scrollToBottom() {
    if (messageListRef.current) {
      messageListRef.current.scrollTop =
        messageListRef.current?.scrollHeight + 1000;
    }
  }

  useEffect(() => {
    socket?.on("connect", () => {
      console.log(`Connected to socket`);
    });

    // when we receive a message from chat:new-message
    socket?.on(NEW_MESSAGE_CHANNEL, (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message]);

      setTimeout(() => {
        scrollToBottom();
      }, 0);
    });
    socket?.on(
      CONNECTION_COUNT_UPDATED_CHANNEL,
      ({ count }: { count: number }) => {
        setConnectionCount(count);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    socket?.emit(NEW_MESSAGE_CHANNEL, {
      message: newMessage,
    });
    setNewMessage("");
  }

  return (
    <main className="flex flex-col p-4 w-full max-w-3xl m-auto">
      <h1 className="text-4xl font-bold text-center mb-4">
        Chat ({connectionCount})
      </h1>
      <ol
        className="flex-1 overflow-y-scroll overflow-x-hidden"
        ref={messageListRef}
      >
        {messages.map((m) => (
          <li key={m.id} className="bg-gray-100 rounded-lg p-4 my-2 break-all">
            <p className="text-small text-gray-500">{m.createdAt}</p>
            <p className="text-small text-gray-500">{m.port}</p>
            <p>{m.message}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={handleSubmit} className="flex items-center">
        <Textarea
          placeholder="Tell us whats on your mind"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          maxLength={255}
          className="rounded-lg mr-4"
        />
        <Button className="h-full">Send message</Button>
      </form>
    </main>
  );
}
