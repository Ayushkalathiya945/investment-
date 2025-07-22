CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `amount_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unused_amount_id` integer NOT NULL,
	`buy_trade_id` integer NOT NULL,
	`amount_used` real NOT NULL,
	`usage_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`unused_amount_id`) REFERENCES `unused_amounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buy_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pan` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`address` text,
	`purse_amount` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_pan_unique` ON `clients` (`pan`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_unique` ON `clients` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_mobile_unique` ON `clients` (`mobile`);--> statement-breakpoint
CREATE TABLE `cron_job_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`status` text NOT NULL,
	`execution_time_ms` integer,
	`error` text,
	`logs` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `cron_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_execution_idx` ON `cron_job_executions` (`job_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `cron_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`schedule` text NOT NULL,
	`command` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_run` integer,
	`next_run` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_jobs_name_unique` ON `cron_jobs` (`name`);--> statement-breakpoint
CREATE TABLE `daily_brokerage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`date` integer NOT NULL,
	`holding_amount` real DEFAULT 0 NOT NULL,
	`unused_amount` real DEFAULT 0 NOT NULL,
	`daily_rate` real,
	`daily_holding_rate` real NOT NULL,
	`daily_unused_rate` real NOT NULL,
	`days_in_quarter` integer,
	`holding_brokerage` real NOT NULL,
	`unused_brokerage` real NOT NULL,
	`total_daily_brokerage` real NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_client_date_idx` ON `daily_brokerage` (`client_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_brokerage_client_id_date_unique` ON `daily_brokerage` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `fifo_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sell_trade_id` integer NOT NULL,
	`buy_trade_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`quantity_allocated` integer NOT NULL,
	`buy_price` real NOT NULL,
	`sell_price` real NOT NULL,
	`buy_date` integer NOT NULL,
	`sell_date` integer NOT NULL,
	`buy_value` real NOT NULL,
	`sell_value` real NOT NULL,
	`profit_loss` real NOT NULL,
	`holding_days` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sell_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buy_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fifo_client_symbol_idx` ON `fifo_allocations` (`client_id`,`symbol`,`exchange`);--> statement-breakpoint
CREATE INDEX `sell_trade_idx` ON `fifo_allocations` (`sell_trade_id`);--> statement-breakpoint
CREATE INDEX `buy_trade_idx` ON `fifo_allocations` (`buy_trade_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`amount` real NOT NULL,
	`payment_type` text DEFAULT 'other' NOT NULL,
	`description` text,
	`payment_date` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_client_date_idx` ON `payments` (`client_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text,
	`exchange` text NOT NULL,
	`sector` text,
	`current_price` real DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stocks_symbol_exchange_unique` ON `stocks` (`symbol`,`exchange`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` real NOT NULL,
	`trade_date` integer NOT NULL,
	`net_amount` real NOT NULL,
	`original_quantity` integer NOT NULL,
	`remaining_quantity` integer NOT NULL,
	`is_fully_sold` integer DEFAULT 0 NOT NULL,
	`sell_processed` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`brokerage_calculated_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_symbol_idx` ON `trades` (`client_id`,`symbol`,`exchange`);--> statement-breakpoint
CREATE INDEX `trade_date_idx` ON `trades` (`trade_date`);--> statement-breakpoint
CREATE INDEX `fifo_idx` ON `trades` (`type`,`is_fully_sold`,`trade_date`);--> statement-breakpoint
CREATE TABLE `unused_amounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`source_trade_id` integer NOT NULL,
	`amount` real NOT NULL,
	`remaining_amount` real NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`last_brokerage_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unused_client_idx` ON `unused_amounts` (`client_id`);--> statement-breakpoint
CREATE INDEX `unused_active_idx` ON `unused_amounts` (`client_id`) WHERE "unused_amounts"."end_date" is null;