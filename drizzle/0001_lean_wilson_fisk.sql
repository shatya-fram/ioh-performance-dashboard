CREATE TABLE `data_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`sheetsLoaded` text,
	`rowCounts` text,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	CONSTRAINT `data_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fm_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(8) NOT NULL,
	`mtd` timestamp,
	`brand` varchar(16) NOT NULL,
	`circle` varchar(64),
	`regionCircle` varchar(64),
	`area` varchar(64),
	`salesArea` varchar(64),
	`microCluster` varchar(128),
	`kabkotNm` varchar(64),
	`seaSegment` varchar(64),
	`tagGroupV2` varchar(64),
	`revPrepaid` double,
	`subsRgu90d` double,
	`subsRgu30d` double,
	`subsGrossAdd` double,
	`packPurchaseMtd` double,
	`subsAvgVlrDaily` double,
	`revAcqM0` double,
	`m2s` double,
	`gaM2s` double,
	`revBase` double,
	`revVsd` double,
	`revNonTrade` double,
	`revTrade` double,
	`revOrganic` double,
	CONSTRAINT `fm_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kec_rank` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kecamatan` varchar(128) NOT NULL,
	`kabkot` varchar(64),
	`im3Lmtd` double,
	`im3Mtd` double,
	`im3Gap` double,
	`threeidLmtd` double,
	`threeidMtd` double,
	`threeidGap` double,
	`im3HvcLmtd` double,
	`im3HvcMtd` double,
	`im3HvcGap` double,
	`threeidHvcLmtd` double,
	`threeidHvcMtd` double,
	`threeidHvcGap` double,
	`area` varchar(64),
	CONSTRAINT `kec_rank_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`fieldName` varchar(64) NOT NULL,
	`divisor` double DEFAULT 1,
	`unit` varchar(32),
	`colIndex` int,
	`isDefault` boolean DEFAULT false,
	`category` varchar(64) DEFAULT 'revenue',
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `kpi_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mtd_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(8) NOT NULL,
	`mtd` timestamp,
	`brand` varchar(16) NOT NULL,
	`circle` varchar(64),
	`regionCircle` varchar(64),
	`area` varchar(64),
	`salesArea` varchar(64),
	`microCluster` varchar(128),
	`kabkotNm` varchar(64),
	`seaSegment` varchar(64),
	`tagGroupV2` varchar(64),
	`revPrepaid` double,
	`subsRgu90d` double,
	`subsRgu30d` double,
	`subsGrossAdd` double,
	`packPurchaseMtd` double,
	`subsAvgVlrDaily` double,
	`revAcqM0` double,
	`m2s` double,
	`gaM2s` double,
	`revBase` double,
	`revVsd` double,
	`revNonTrade` double,
	`revTrade` double,
	`revOrganic` double,
	CONSTRAINT `mtd_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rev_segments_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monthMtd` varchar(8) NOT NULL,
	`brand` varchar(16) NOT NULL,
	`kabkotNm` varchar(64),
	`area` varchar(64),
	`regionCircle` varchar(64),
	`circle` varchar(64),
	`valueSegment` varchar(32),
	`subscriber` double,
	CONSTRAINT `rev_segments_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vlr_tenure_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand` varchar(16) NOT NULL,
	`tenureGroup` varchar(32) NOT NULL,
	`circle` varchar(64),
	`regionCircle` varchar(64),
	`area` varchar(64),
	`kabkotNm` varchar(64),
	`kecamatanNm` varchar(128),
	`yearMonth` varchar(8) NOT NULL,
	`vlrDlyFm` double,
	CONSTRAINT `vlr_tenure_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voucher_game_raw` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(8) NOT NULL,
	`brand` varchar(16),
	`area` varchar(64),
	`kabkotNm` varchar(64),
	`voucherRevenue` double,
	`gameRevenue` double,
	`totalEffect` double,
	CONSTRAINT `voucher_game_raw_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fm_raw_yearmonth_brand` ON `fm_raw` (`yearMonth`,`brand`);--> statement-breakpoint
CREATE INDEX `fm_raw_area` ON `fm_raw` (`area`);--> statement-breakpoint
CREATE INDEX `fm_raw_kabkot` ON `fm_raw` (`kabkotNm`);--> statement-breakpoint
CREATE INDEX `mtd_raw_yearmonth_brand` ON `mtd_raw` (`yearMonth`,`brand`);--> statement-breakpoint
CREATE INDEX `mtd_raw_area` ON `mtd_raw` (`area`);--> statement-breakpoint
CREATE INDEX `mtd_raw_kabkot` ON `mtd_raw` (`kabkotNm`);--> statement-breakpoint
CREATE INDEX `rev_seg_brand_month` ON `rev_segments_raw` (`brand`,`monthMtd`);--> statement-breakpoint
CREATE INDEX `rev_seg_kabkot` ON `rev_segments_raw` (`kabkotNm`);--> statement-breakpoint
CREATE INDEX `vlr_tenure_brand_month` ON `vlr_tenure_raw` (`brand`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `vlr_tenure_area` ON `vlr_tenure_raw` (`area`);--> statement-breakpoint
CREATE INDEX `vlr_tenure_kec` ON `vlr_tenure_raw` (`kecamatanNm`);