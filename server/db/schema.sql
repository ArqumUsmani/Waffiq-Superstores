-- Wafiq online store. Applied by `npm run db:migrate`; every statement is
-- safe to run again. Money is whole rupees (INT); times are UTC.

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  sku VARCHAR(120) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ur VARCHAR(255) NOT NULL DEFAULT '',
  brand VARCHAR(120) NOT NULL DEFAULT '',
  category VARCHAR(64) NOT NULL,
  subcategory VARCHAR(64) NOT NULL,
  size VARCHAR(120) NOT NULL DEFAULT '',
  image VARCHAR(255) NULL,
  price INT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(190) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  area VARCHAR(120) NOT NULL,
  notes VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(16) NULL,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('placed', 'confirmed', 'packed', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled')
    NOT NULL DEFAULT 'placed',
  fulfilment ENUM('delivery', 'pickup') NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  address_line VARCHAR(255) NOT NULL DEFAULT '',
  area VARCHAR(120) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  subtotal INT NOT NULL,
  delivery_fee INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  payment_method ENUM('cod') NOT NULL DEFAULT 'cod',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_number (number),
  KEY idx_orders_user (user_id),
  KEY idx_orders_created (created_at),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Name, size and price are copied at the moment of sale: later edits to a
-- product must never rewrite what a past order says was bought.
CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  sku VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  size VARCHAR(120) NOT NULL DEFAULT '',
  price INT NOT NULL,
  qty INT NOT NULL,
  KEY idx_items_order (order_id),
  KEY idx_items_sku (sku),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every change to stock, with why. The audit trail behind the stock figure.
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(120) NOT NULL,
  delta INT NOT NULL,
  reason ENUM('seed', 'sale', 'cancel', 'adjust') NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT '',
  order_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_moves_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- For rate-limiting sign-in.
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  ok TINYINT(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempts_phone (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
