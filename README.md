# SENA TECH — Sistema de Control de Equipos v2.0

## 📁 Estructura del proyecto

```
senatech/
├── backend/
│   ├── server.js          ← Servidor Express principal
│   ├── db.js              ← Conexión a MySQL
│   └── routes/
│       ├── auth.js        ← Login y registro de usuarios
│       └── registros.js   ← Equipos y registros entrada/salida
├── frontend/
│   ├── index.html         ← HTML principal (solo estructura)
│   ├── css/
│   │   └── styles.css     ← Todo el diseño visual
│   └── js/
│       ├── app.js         ← Utilidades globales
│       ├── auth.js        ← Lógica de autenticación
│       ├── usuario.js     ← Dashboard del usuario
│       └── vigilante.js   ← Dashboard del vigilante
├── database/
│   └── senatech.sql       ← Script para crear la BD en MySQL
├── .env                   ← Variables de entorno (NO subir a Git)
├── package.json
└── README.md
```

---

## 🚀 Instalación paso a paso

### 1. Instalar Node.js
Descarga Node.js desde: https://nodejs.org (versión LTS recomendada)

### 2. Instalar MySQL
Descarga MySQL Community desde: https://dev.mysql.com/downloads/

### 3. Crear la base de datos
Abre MySQL Workbench (o la terminal de MySQL) y ejecuta:
```sql
-- Copiar y ejecutar el contenido
 de: database/senatech.sql
```

### 4. Configurar el archivo .env
Abre `.env` y edita tu contraseña de MySQL:
```
DB_PASSWORD=tu_contraseña_de_mysql
```

### 5. Instalar dependencias de Node.js
Abre una terminal en la carpeta `senatech/` y ejecuta:
```bash
npm install
```

### 6. Iniciar el servidor
```bash
# Modo normal
npm start

# Modo desarrollo (reinicia automáticamente)
npm run dev
```

### 7. Abrir la app
Abre tu navegador en: **http://localhost:3000**

---

## 🔑 Credenciales por defecto

| Rol       | Usuario    | Contraseña |
|-----------|-----------|------------|
| Vigilante | vigilante  | 1234       |

> Los usuarios normales se crean desde la app (botón "Crear cuenta")

---

## 📱 Cómo usar la app

### Usuario (aprendiz/empleado):
1. Crea tu cuenta con tu cédula
2. Ve a **Mi Equipo** y registra los datos del equipo
3. Ve a **Mi QR** para ver tu código
4. Muéstraselo al vigilante al entrar o salir

### Vigilante:
1. Ingresa con usuario `vigilante` / contraseña `1234`
2. Ve a **Escanear** y activa la cámara
3. Escanea el QR del usuario — la app detecta automáticamente si es entrada o salida
4. Confirma el registro
5. En **Historial** puedes ver todos los movimientos
6. En **Exportar** puedes descargar CSV o reporte del día

---

## 🛠️ Tecnologías usadas

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend**: Node.js + Express
- **Base de datos**: MySQL
- **Autenticación**: JWT (JSON Web Tokens)
- **QR Generate**: qrcode.js
- **QR Scanner**: html5-qrcode

---

## ⚙️ Endpoints de la API

| Método | Ruta                        | Descripción                  |
|--------|-----------------------------|------------------------------|
| POST   | /api/auth/login             | Iniciar sesión               |
| POST   | /api/auth/registro          | Crear cuenta nueva           |
| GET    | /api/equipo/mio             | Ver mi equipo                |
| POST   | /api/equipo/guardar         | Guardar/actualizar equipo    |
| POST   | /api/registros/escanear     | Registrar entrada/salida     |
| GET    | /api/registros/mios         | Mi historial                 |
| GET    | /api/registros/todos        | Todos los registros (admin)  |
| GET    | /api/registros/stats        | Estadísticas del día         |
| DELETE | /api/registros/limpiar      | Limpiar historial            |
