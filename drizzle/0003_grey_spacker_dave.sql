CREATE TABLE `soga_dms_weekly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kecamatan_nm` varchar(128) NOT NULL,
	`brand` varchar(8) NOT NULL,
	`metric` varchar(8) NOT NULL,
	`year_week` varchar(8) NOT NULL,
	`value` double,
	CONSTRAINT `soga_dms_weekly_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `soga_dms_brand_metric_week` ON `soga_dms_weekly` (`brand`,`metric`,`year_week`);--> statement-breakpoint
CREATE INDEX `soga_dms_kec` ON `soga_dms_weekly` (`kecamatan_nm`);