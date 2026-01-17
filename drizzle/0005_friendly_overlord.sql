ALTER TABLE `chats` ADD `provider_id` text DEFAULT 'claude';--> statement-breakpoint
ALTER TABLE `sub_chats` ADD `provider_id` text DEFAULT 'claude';