CREATE TABLE `api_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`protocol` text DEFAULT 'openai-compatible' NOT NULL,
	`base_url` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`models` text DEFAULT '[]' NOT NULL,
	`context_window` integer DEFAULT 128000 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
