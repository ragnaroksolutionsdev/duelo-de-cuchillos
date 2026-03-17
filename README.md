# 🗡️ Duelo de Cuchillos

App de votación estilo juego flash: las respuestas se convierten en pelotitas con ojos y cuchillos que se pelean en una arena 2D. Gana el equipo que sobreviva.

## Stack

| Capa | Tech |
|---|---|
| Frontend | React + Vite + Phaser 3 |
| Backend | Node.js + Express + Socket.io |
| Base de datos | Supabase (PostgreSQL) |
| Deploy web | Netlify |
| Deploy servidor | Render |

## Flujo

1. **Host** crea sala → escribe pregunta + 2-4 respuestas → obtiene código de 4 letras
2. **Jugadores** entran con el código → eligen su respuesta (anónimo)
3. **Host** inicia la pelea → todos ven la arena
4. Las pelotitas de distintos colores se pelean automáticamente → gana el último color en pie

## Estructura

```
duelo-de-cuchillos/
├── client/          # React + Phaser → Netlify
├── server/          # Express + Socket.io → Render
├── shared/          # Tipos TypeScript compartidos
└── supabase/        # Migraciones SQL
```

## Setup local

### Prerrequisitos
- Node.js 20+
- Cuenta Supabase (gratis)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Corre `supabase/migrations/001_initial.sql` en el SQL Editor
3. Copia la URL y las keys

### 2. Servidor
```bash
cd server
cp .env.example .env
# Llena .env con tus keys de Supabase
npm install
npm run dev
```

### 3. Cliente
```bash
cd client
cp .env.example .env
# VITE_SERVER_URL=http://localhost:3001
npm install
npm run dev
```

## Deploy

### Netlify (cliente)
1. Conecta el repo en [netlify.com](https://netlify.com)
2. Base dir: `client`, Build: `npm run build`, Publish: `dist`
3. Agrega env var: `VITE_SERVER_URL=https://tu-app.onrender.com`

### Render (servidor)
1. Conecta el repo en [render.com](https://render.com)
2. Render detecta `render.yaml` automáticamente
3. Agrega las env vars en el dashboard: `CLIENT_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Variables de entorno

### server/.env
```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### client/.env
```
VITE_SERVER_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Privacidad

- Los jugadores no tienen nombre ni cuenta
- Solo se guarda: pregunta, respuestas, conteo por equipo y ganador
- No se almacena qué individuo eligió qué respuesta
