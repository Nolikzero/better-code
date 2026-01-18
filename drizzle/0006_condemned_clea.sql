CREATE INDEX `chats_project_id_idx` ON `chats` (`project_id`);--> statement-breakpoint
CREATE INDEX `chats_archived_at_idx` ON `chats` (`archived_at`);--> statement-breakpoint
CREATE INDEX `sub_chats_chat_id_idx` ON `sub_chats` (`chat_id`);