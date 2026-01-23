CREATE TABLE `ralph_prds` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`branch_name` text,
	`goal` text,
	`stories` text DEFAULT '[]' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ralph_prds_chat_id_idx` ON `ralph_prds` (`chat_id`);--> statement-breakpoint
CREATE TABLE `ralph_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`prd_id` text NOT NULL,
	`story_id` text,
	`iteration` integer,
	`summary` text,
	`learnings` text,
	`timestamp` integer,
	FOREIGN KEY (`prd_id`) REFERENCES `ralph_prds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ralph_progress_prd_id_idx` ON `ralph_progress` (`prd_id`);