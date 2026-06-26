CREATE TABLE `product_mtd_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(8) NOT NULL,
	`brand` varchar(16) NOT NULL,
	`areaRegion` varchar(64),
	`areaBranch` varchar(64),
	`areaKabkot` varchar(64),
	`channelGroup` varchar(64),
	`channelDetail` varchar(64),
	`productFamily` varchar(128),
	`productGroup` varchar(256),
	`atlBtl` varchar(16),
	`atlBtlDetail` varchar(64),
	`tenure` varchar(32),
	`merchant` varchar(128),
	`kpi` varchar(64) NOT NULL,
	`rev` bigint,
	CONSTRAINT `product_mtd_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `prod_mtd_brand_month` ON `product_mtd_raw` (`brand`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `prod_mtd_channel` ON `product_mtd_raw` (`channelGroup`);--> statement-breakpoint
CREATE INDEX `prod_mtd_kpi` ON `product_mtd_raw` (`kpi`);--> statement-breakpoint
CREATE INDEX `prod_mtd_branch` ON `product_mtd_raw` (`areaBranch`);--> statement-breakpoint
CREATE INDEX `prod_mtd_kabkot` ON `product_mtd_raw` (`areaKabkot`);