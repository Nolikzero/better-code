ALTER TABLE `sub_chats` ADD `has_pending_plan_approval` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `sub_chats` ADD `file_additions` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sub_chats` ADD `file_deletions` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sub_chats` ADD `file_count` integer DEFAULT 0;