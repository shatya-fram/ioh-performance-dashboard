-- ─────────────────────────────────────────────────────────────────────────────
-- IOH Performance Dashboard — Complete Database Schema
-- Run this on a fresh MySQL 8 database to create all tables
-- Usage: mysql -u root -p ioh_dashboard < deploy/database/01_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `open_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `avatar` varchar(1024),
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_open_id_unique` (`open_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── KPI Performance (MTD/FM raw data) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kpi_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_date` varchar(10) NOT NULL,
  `brand` varchar(10) NOT NULL,
  `area` varchar(100),
  `location` varchar(100),
  `channel` varchar(50),
  `revenue_mtd` decimal(20,2) DEFAULT NULL,
  `revenue_lmtd` decimal(20,2) DEFAULT NULL,
  `revenue_fm` decimal(20,2) DEFAULT NULL,
  `acq_revenue_mtd` decimal(20,2) DEFAULT NULL,
  `acq_revenue_lmtd` decimal(20,2) DEFAULT NULL,
  `base_revenue_mtd` decimal(20,2) DEFAULT NULL,
  `base_revenue_lmtd` decimal(20,2) DEFAULT NULL,
  `vlr_mtd` decimal(20,2) DEFAULT NULL,
  `vlr_lmtd` decimal(20,2) DEFAULT NULL,
  `gross_add_mtd` decimal(20,2) DEFAULT NULL,
  `gross_add_lmtd` decimal(20,2) DEFAULT NULL,
  `pack_pu_mtd` decimal(20,2) DEFAULT NULL,
  `pack_pu_lmtd` decimal(20,2) DEFAULT NULL,
  `arpu_mtd` decimal(20,2) DEFAULT NULL,
  `arpu_lmtd` decimal(20,2) DEFAULT NULL,
  `rgu90d_mtd` decimal(20,2) DEFAULT NULL,
  `rgu90d_lmtd` decimal(20,2) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_kpi_date_brand` (`data_date`, `brand`),
  KEY `idx_kpi_area` (`area`),
  KEY `idx_kpi_channel` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── FM Raw (full-month snapshots) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `fm_raw` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_date` varchar(10) NOT NULL,
  `brand` varchar(10) NOT NULL,
  `area` varchar(100),
  `location` varchar(100),
  `channel` varchar(50),
  `revenue` decimal(20,2) DEFAULT NULL,
  `acq_revenue` decimal(20,2) DEFAULT NULL,
  `base_revenue` decimal(20,2) DEFAULT NULL,
  `vlr` decimal(20,2) DEFAULT NULL,
  `gross_add` decimal(20,2) DEFAULT NULL,
  `pack_pu` decimal(20,2) DEFAULT NULL,
  `arpu` decimal(20,2) DEFAULT NULL,
  `rgu90d` decimal(20,2) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fm_date_brand` (`data_date`, `brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── MTD Raw (month-to-date daily snapshots) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `mtd_raw` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_date` varchar(10) NOT NULL,
  `brand` varchar(10) NOT NULL,
  `area` varchar(100),
  `location` varchar(100),
  `channel` varchar(50),
  `revenue` decimal(20,2) DEFAULT NULL,
  `acq_revenue` decimal(20,2) DEFAULT NULL,
  `base_revenue` decimal(20,2) DEFAULT NULL,
  `vlr` decimal(20,2) DEFAULT NULL,
  `gross_add` decimal(20,2) DEFAULT NULL,
  `pack_pu` decimal(20,2) DEFAULT NULL,
  `arpu` decimal(20,2) DEFAULT NULL,
  `rgu90d` decimal(20,2) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mtd_date_brand` (`data_date`, `brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── VLR Kecamatan (kecamatan-level VLR data) ────────────────────────────────
CREATE TABLE IF NOT EXISTS `vlr_kecamatan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_date` varchar(10) NOT NULL,
  `kecamatan` varchar(100) NOT NULL,
  `area` varchar(100),
  `brand` varchar(10) NOT NULL,
  `vlr_mtd` decimal(10,2) DEFAULT NULL,
  `vlr_lmtd` decimal(10,2) DEFAULT NULL,
  `vlr_gap` decimal(10,2) DEFAULT NULL,
  `vlr_rate` decimal(10,4) DEFAULT NULL,
  `mom_growth` decimal(10,4) DEFAULT NULL,
  `latitude` decimal(10,6) DEFAULT NULL,
  `longitude` decimal(10,6) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vlr_date_brand` (`data_date`, `brand`),
  KEY `idx_vlr_kecamatan` (`kecamatan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Product Data ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_date` varchar(10) NOT NULL,
  `brand` varchar(10) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `category` varchar(100),
  `channel` varchar(50),
  `hits_mtd` decimal(20,2) DEFAULT NULL,
  `hits_lmtd` decimal(20,2) DEFAULT NULL,
  `revenue_mtd` decimal(20,2) DEFAULT NULL,
  `revenue_lmtd` decimal(20,2) DEFAULT NULL,
  `ticket_size` decimal(20,2) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_date_brand` (`data_date`, `brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SOGA/DMS Weekly (kecamatan-level weekly distribution metrics) ────────────
CREATE TABLE IF NOT EXISTS `soga_dms_weekly` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week_label` varchar(10) NOT NULL,
  `kecamatan` varchar(100) NOT NULL,
  `brand` varchar(10) NOT NULL,
  `metric_type` enum('SOGA','DMS') NOT NULL,
  `value` decimal(10,4) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_soga_week_brand` (`week_label`, `brand`),
  KEY `idx_soga_kecamatan` (`kecamatan`),
  KEY `idx_soga_metric` (`metric_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema created successfully
-- Next: run 02_indexes.sql for additional performance indexes
-- ─────────────────────────────────────────────────────────────────────────────
