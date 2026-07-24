CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  store_name VARCHAR(255) NOT NULL,
  purchase_date DATE NOT NULL,
  warranty_duration INT UNSIGNED NOT NULL,
  warranty_unit ENUM('days', 'months', 'years') NOT NULL,
  expiration_date DATE NOT NULL,
  serial_number VARCHAR(255) NULL,
  notes TEXT NULL,
  invoice_path VARCHAR(500) NULL,
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_days_before INT UNSIGNED NULL,
  is_reminded BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at DATETIME NULL,
  reminder_claim_token CHAR(36) NULL,
  reminder_claimed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT products_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY products_user_expiration_index (user_id, expiration_date),
  KEY products_reminder_due_index (reminder_enabled, is_reminded, expiration_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY password_reset_token_hash_unique (token_hash),
  CONSTRAINT password_reset_tokens_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) NOT NULL,
  data JSON NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (sid),
  KEY sessions_expires_at_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(190) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
