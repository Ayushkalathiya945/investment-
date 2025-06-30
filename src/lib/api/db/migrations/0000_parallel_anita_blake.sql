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
CREATE TABLE `brokerage_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brokerage_id` integer NOT NULL,
	`trade_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`quantity` integer NOT NULL,
	`buy_price` real NOT NULL,
	`buy_date` integer NOT NULL,
	`holding_start_date` integer NOT NULL,
	`holding_end_date` integer NOT NULL,
	`holding_days` integer NOT NULL,
	`total_days_in_month` integer NOT NULL,
	`position_value` real NOT NULL,
	`monthly_brokerage_rate` real DEFAULT 10 NOT NULL,
	`daily_brokerage_rate` real NOT NULL,
	`brokerage_amount` real NOT NULL,
	`is_sold_in_month` integer DEFAULT 0 NOT NULL,
	`sell_date` integer,
	`sell_price` real,
	`sell_value` real,
	`partial_sale_quantity` integer,
	`calculation_formula` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`brokerage_id`) REFERENCES `brokerages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `brokerage_trade_idx` ON `brokerage_details` (`brokerage_id`,`trade_id`);--> statement-breakpoint
CREATE TABLE `brokerages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`calculation_period` integer NOT NULL,
	`brokerage_rate` real DEFAULT 10 NOT NULL,
	`total_days_in_month` integer NOT NULL,
	`total_holding_value` real NOT NULL,
	`total_holding_days` integer NOT NULL,
	`brokerage_amount` real NOT NULL,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0,
	`total_positions` integer NOT NULL,
	`calculated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `period_idx` ON `brokerages` (`calculation_period`);--> statement-breakpoint
CREATE UNIQUE INDEX `brokerages_client_id_calculation_period_unique` ON `brokerages` (`client_id`,`calculation_period`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pan` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`address` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_pan_unique` ON `clients` (`pan`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_unique` ON `clients` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_mobile_unique` ON `clients` (`mobile`);--> statement-breakpoint
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
	FOREIGN KEY (`sell_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buy_trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE no action
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
	`brokerage_id` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_client_date_idx` ON `payments` (`client_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`quantity` integer NOT NULL,
	`average_price` real NOT NULL,
	`total_investment` real NOT NULL,
	`first_purchase_date` integer NOT NULL,
	`last_brokerage_month` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_client_id_symbol_exchange_unique` ON `positions` (`client_id`,`symbol`,`exchange`);--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
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
	`last_brokerage_calculated` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_symbol_idx` ON `trades` (`client_id`,`symbol`,`exchange`);--> statement-breakpoint
CREATE INDEX `trade_date_idx` ON `trades` (`trade_date`);--> statement-breakpoint
CREATE INDEX `fifo_idx` ON `trades` (`type`,`is_fully_sold`,`trade_date`);