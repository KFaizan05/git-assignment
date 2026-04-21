-- =============================================================================
-- LabelWise  -  MySQL schema
-- =============================================================================
CREATE DATABASE IF NOT EXISTS labelwise
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE labelwise;

DROP TABLE IF EXISTS scans;
DROP TABLE IF EXISTS account_custom_allergens;
DROP TABLE IF EXISTS account_allergens;
DROP TABLE IF EXISTS account_dietary;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS accounts;

CREATE TABLE accounts (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255)    NOT NULL,
  password_hash  VARCHAR(255)    NULL,
  is_guest       TINYINT(1)      NOT NULL DEFAULT 0,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profiles (
  account_id  BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(120)    NOT NULL DEFAULT '',
  -- Persisted UI language preference. Mirrors the old localStorage
  -- `labelwiseLanguage` so the picker in Settings syncs across devices.
  -- Valid values: 'English', 'Español', 'Français' (see js/i18n.js).
  language    VARCHAR(32)     NOT NULL DEFAULT 'English',
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  CONSTRAINT fk_profiles_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_dietary (
  account_id  BIGINT UNSIGNED NOT NULL,
  tag         VARCHAR(80)     NOT NULL,
  PRIMARY KEY (account_id, tag),
  CONSTRAINT fk_dietary_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_allergens (
  account_id  BIGINT UNSIGNED NOT NULL,
  tag         VARCHAR(80)     NOT NULL,
  PRIMARY KEY (account_id, tag),
  CONSTRAINT fk_allergens_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_custom_allergens (
  account_id  BIGINT UNSIGNED NOT NULL,
  tag         VARCHAR(120)    NOT NULL,
  PRIMARY KEY (account_id, tag),
  CONSTRAINT fk_custom_allergens_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scans (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id         BIGINT UNSIGNED NOT NULL,
  product_name       VARCHAR(255)    NOT NULL DEFAULT 'Scanned Product',
  brand_name         VARCHAR(255)    NOT NULL DEFAULT '',
  status             ENUM('Safe','Unsafe','Caution') NOT NULL DEFAULT 'Safe',
  category           VARCHAR(120)    NOT NULL DEFAULT '',
  note               TEXT            NULL,
  saved_to_safe      TINYINT(1)      NOT NULL DEFAULT 0,
  thumbnail          LONGTEXT        NULL,
  ocr_text           MEDIUMTEXT      NULL,
  client_scanned_at  BIGINT UNSIGNED NOT NULL,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scans_account_time  (account_id, client_scanned_at DESC),
  KEY idx_scans_account_status (account_id, status),
  KEY idx_scans_account_saved  (account_id, saved_to_safe),
  CONSTRAINT fk_scans_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
