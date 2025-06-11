CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `brokerage_calculations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`total_trades` integer NOT NULL,
	`total_turnover` real NOT NULL,
	`cron_job_id` integer NOT NULL,
	`brokerage_amount` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cron_job_id`) REFERENCES `cron_jobs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brokerage_calculations_client_id_month_year_unique` ON `brokerage_calculations` (`client_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `client_holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`stock_id` integer NOT NULL,
	`cron_job_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`current_value` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cron_job_id`) REFERENCES `cron_jobs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_holdings_client_id_stock_id_cron_job_id_unique` ON `client_holdings` (`client_id`,`stock_id`,`cron_job_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pan` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_pan_unique` ON `clients` (`pan`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_unique` ON `clients` (`email`);--> statement-breakpoint
CREATE TABLE `cron_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_jobs_job_name_unique` ON `cron_jobs` (`job_name`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`payment_date` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`exchange` text NOT NULL,
	`isin` text NOT NULL,
	`sector` text,
	`current_price` real DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stocks_symbol_unique` ON `stocks` (`symbol`);--> statement-breakpoint
CREATE UNIQUE INDEX `stocks_isin_unique` ON `stocks` (`isin`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`stock_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` real NOT NULL,
	`trade_date` integer NOT NULL,
	`net_amount` real NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON UPDATE no action ON DELETE restrict
);
