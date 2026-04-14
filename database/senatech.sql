-- ============================================
--  SENA TECH v3.0 — Base de datos MySQL
-- ============================================
CREATE DATABASE IF NOT EXISTS senatech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE senatech;

-- ── USUARIOS ──────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cedula          VARCHAR(20)  NOT NULL UNIQUE,
  nombre          VARCHAR(100) NOT NULL,
  rol             ENUM('Aprendiz','Instructor','Empleado','Visitante','Vigilante') NOT NULL DEFAULT 'Aprendiz',
  tipo            ENUM('user','guard','admin') NOT NULL DEFAULT 'user',
  password        VARCHAR(255) NOT NULL,
  pregunta_seg    VARCHAR(200),          -- pregunta de seguridad
  respuesta_seg   VARCHAR(255),          -- respuesta hasheada
  estado          ENUM('activo','pendiente','bloqueado') NOT NULL DEFAULT 'activo',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── EQUIPOS ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  tipo        ENUM('Portátil','Computadora','Tablet') NOT NULL DEFAULT 'Portátil',
  marca       VARCHAR(80)  NOT NULL,
  serial      VARCHAR(100) NOT NULL UNIQUE,
  modelo      VARCHAR(100),
  color       VARCHAR(30)  NOT NULL DEFAULT 'Plata',
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ── REGISTROS ─────────────────────────────
CREATE TABLE IF NOT EXISTS registros (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  equipo_id       INT NOT NULL,
  usuario_id      INT NOT NULL,
  vigilante_id    INT,
  tipo            ENUM('entrada','salida') NOT NULL,
  metodo          ENUM('qr','clave') NOT NULL DEFAULT 'qr',
  timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipo_id)    REFERENCES equipos(id)  ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)   REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (vigilante_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ── VISTA REGISTROS ───────────────────────
CREATE OR REPLACE VIEW vista_registros AS
SELECT
  r.id, r.tipo, r.metodo, r.timestamp,
  u.nombre  AS nombre_usuario, u.cedula, u.rol,
  e.nombre  AS equipo_nombre,  e.tipo AS equipo_tipo,
  e.serial, e.marca, e.modelo, e.color,
  v.nombre  AS vigilante
FROM registros r
JOIN usuarios u  ON r.usuario_id   = u.id
JOIN equipos  e  ON r.equipo_id    = e.id
LEFT JOIN usuarios v ON r.vigilante_id = v.id
ORDER BY r.timestamp DESC;

-- ── ADMIN MAESTRO ─────────────────────────
-- usuario: admin | contraseña: Admin2026#
INSERT IGNORE INTO usuarios (cedula, nombre, rol, tipo, password, estado) VALUES
('admin','Administrador SENA','Vigilante','admin',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','activo');
-- NOTA: contraseña = "password" (hash bcrypt estándar de prueba)
-- Cámbiala INMEDIATAMENTE con: UPDATE usuarios SET password=<nuevo_hash> WHERE cedula='admin';
