import { EventEmitter } from "events";

export interface ChatStatsEvent {
  type: "file-stats" | "plan-approval";
  chatId: string;
  subChatId: string;
}

class ChatStatsEmitter extends EventEmitter {
  emitStatsUpdate(event: ChatStatsEvent) {
    this.emit("stats-update", event);
  }

  onStatsUpdate(handler: (event: ChatStatsEvent) => void) {
    this.on("stats-update", handler);
    return () => this.off("stats-update", handler);
  }
}

export const chatStatsEmitter = new ChatStatsEmitter();
