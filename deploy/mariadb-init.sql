-- ==========================================================
-- Aurion MMORPG - MariaDB / MySQL Schema Reconciler & Init
-- Database: aurion_mmo
-- Supports: Character state, equipment, inventory, quests,
--           world state, and external GLB asset registry.
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `aurion_mmo`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `aurion_mmo`;

-- 1. Aurion Players
CREATE TABLE IF NOT EXISTS `aurion_players` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(64) NOT NULL,
  `class_id` VARCHAR(32) NOT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `xp` BIGINT NOT NULL DEFAULT 0,
  `xp_to_next_level` BIGINT NOT NULL DEFAULT 100,
  `hp` INT NOT NULL DEFAULT 200,
  `max_hp` INT NOT NULL DEFAULT 200,
  `resource` INT NOT NULL DEFAULT 100,
  `max_resource` INT NOT NULL DEFAULT 100,
  `gold` BIGINT NOT NULL DEFAULT 50,
  `score` BIGINT NOT NULL DEFAULT 0,
  `stat_points` INT NOT NULL DEFAULT 0,
  `strength` INT NOT NULL DEFAULT 10,
  `agility` INT NOT NULL DEFAULT 10,
  `intelligence` INT NOT NULL DEFAULT 10,
  `defense` INT NOT NULL DEFAULT 10,
  `pos_x` FLOAT NOT NULL DEFAULT 0,
  `pos_y` FLOAT NOT NULL DEFAULT 0.95,
  `pos_z` FLOAT NOT NULL DEFAULT 0,
  `facing_angle` FLOAT NOT NULL DEFAULT 0,
  `active_weapon_type` VARCHAR(32) NOT NULL DEFAULT 'blade',
  `is_mounted` TINYINT(1) NOT NULL DEFAULT 0,
  `active_model_glb` VARCHAR(256) DEFAULT NULL,
  `weapon_masteries` JSON DEFAULT NULL,
  `unlocked_titles` JSON DEFAULT NULL,
  `active_title` VARCHAR(128) DEFAULT NULL,
  `last_saved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_player_level` (`level`),
  INDEX `idx_player_score` (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Equipment Slots (all 8 slots + mount/relic)
CREATE TABLE IF NOT EXISTS `aurion_equipment` (
  `player_id` VARCHAR(64) NOT NULL,
  `slot` VARCHAR(32) NOT NULL,
  `item_id` VARCHAR(64) DEFAULT NULL,
  `item_name` VARCHAR(128) DEFAULT NULL,
  `rarity` VARCHAR(32) DEFAULT NULL,
  `item_data` JSON DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_id`, `slot`),
  INDEX `idx_equip_player` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Inventory Bag Items
CREATE TABLE IF NOT EXISTS `aurion_inventory` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `player_id` VARCHAR(64) NOT NULL,
  `slot_index` INT NOT NULL,
  `item_id` VARCHAR(64) NOT NULL,
  `item_name` VARCHAR(128) NOT NULL,
  `item_data` JSON NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_inv_player` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Dynamic & Persistent Quests
CREATE TABLE IF NOT EXISTS `aurion_quests` (
  `player_id` VARCHAR(64) NOT NULL,
  `quest_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  `lore` TEXT,
  `objective` TEXT,
  `type` VARCHAR(32) DEFAULT 'near_miss',
  `progress` INT NOT NULL DEFAULT 0,
  `target_count` INT NOT NULL DEFAULT 5,
  `reward_xp` INT NOT NULL DEFAULT 50,
  `reward_score` INT NOT NULL DEFAULT 150,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_id`, `quest_id`),
  INDEX `idx_quest_status` (`player_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Open-World Server State
CREATE TABLE IF NOT EXISTS `aurion_world_state` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `time_of_day` FLOAT NOT NULL DEFAULT 0.25,
  `weather` VARCHAR(32) NOT NULL DEFAULT 'clear',
  `leyline_charge` FLOAT NOT NULL DEFAULT 100,
  `active_events` JSON DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. External GLB Model Catalog
CREATE TABLE IF NOT EXISTS `aurion_glb_catalog` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `file_name` VARCHAR(256) NOT NULL,
  `url` VARCHAR(256) NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'prop',
  `triangle_count` INT NOT NULL DEFAULT 0,
  `bone_count` INT NOT NULL DEFAULT 0,
  `file_size_bytes` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ready',
  `animation_clips` JSON DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `registered_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_glb_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. System Audit & Telemetry Logs
CREATE TABLE IF NOT EXISTS `aurion_system_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(64) NOT NULL,
  `message` TEXT NOT NULL,
  `details` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_log_event` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
