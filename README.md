# Duelo de Cuchillos

App de votación estilo juego flash: las respuestas se convierten en pelotitas con ojos y cuchillos que se pelean en una arena 2D. Gana el equipo que sobreviva.

## Stack

| Capa | Tech |
|---|---|
| Frontend | React + Vite + Phaser 3 |
| Backend | Node.js + Express + Socket.io |
| Base de datos | Supabase (PostgreSQL) |
| Deploy web | Netlify |
| Deploy servidor | Render |

## Flujo del juego

1. **Host** crea sala → escribe pregunta + 2-4 respuestas → obtiene código de 4 letras
2. **Jugadores** entran con el código → eligen su respuesta (anónimo)
3. **Host** inicia la pelea → cuenta regresiva de 5s (aún se puede cambiar de bando)
4. Las pelotitas de distintos colores se pelean automáticamente → gana el último color en pie
5. A los 5s arranca **Muerte Súbita**: velocidad y fuerza suben cada 5s y el ring se encoge

---

## Estructura del proyecto

```
duelo-de-cuchillos/
├── client/          # React + Phaser 3 → Netlify
├── server/          # Express + Socket.io → Render
├── shared/          # Tipos TypeScript compartidos
└── supabase/        # Migraciones SQL
```

---

## Setup local

### Prerrequisitos
- Node.js 20+
- Cuenta Supabase (gratis)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Corre `supabase/migrations/001_initial.sql` en el SQL Editor
3. Copia la URL y la **service_role key** (no la anon key)

### 2. Servidor
```bash
cd server
cp .env.example .env
# Edita .env con tus credenciales de Supabase
npm install
npm run dev
# Corre en http://localhost:3001
```

### 3. Cliente
```bash
cd client
# Crea client/.env con:
# VITE_SERVER_URL=http://localhost:3001
npm install
npm run dev
# Abre http://localhost:5173
```

---

## Checklist de pruebas locales

Antes de hacer deploy a producción, verificar manualmente:

### Sala pública
- [ ] Crear sala → aparece selector de modo (Pública / Individual)
- [ ] Elegir **Pública** → ingresar pregunta y 2-4 respuestas → crear sala
- [ ] Elegir bando como host → llegar al lobby con código visible
- [ ] Abrir segunda pestaña → Unirse con el código → ver la pregunta real y los bandos disponibles
- [ ] Cambiar de bando en el lobby antes de iniciar
- [ ] Host inicia pelea → **cuenta regresiva 5…4…3…2…1 aparece en el lobby**
- [ ] Durante el countdown se puede cambiar de bando con "Cambiar ahora"
- [ ] Al llegar a 0 → ambas pestañas pasan a la arena con las bolitas
- [ ] Las bolitas se buscan y pelean solas
- [ ] A los 5s aparece banner **MUERTE SÚBITA NIVEL 1**, el ring empieza a encogerse
- [ ] Cada 5s sube el nivel, las bolitas se mueven más rápido y el ring se reduce más
- [ ] Al final hay un ganador (nunca empate por caída simultánea)
- [ ] Pantalla de resultados → host ve botón **⚔️ Volver a Pelear** → vuelve al lobby sin crear sala nueva

### Sala individual (solo)
- [ ] Crear sala → elegir **Individual** → configurar bolitas por equipo (slider 1–15)
- [ ] Al crear → ir directo a la arena sin lobby
- [ ] Cuenta regresiva 3…2…1 en la arena (Phaser necesita tiempo para cargar)
- [ ] La pelea arranca con N bolitas por equipo según el slider
- [ ] Muerte Súbita y ring dinámico funcionan igual
- [ ] **⚔️ Volver a Pelear** reinicia con la misma configuración (mismo N de bolitas)

### Visual y audio
- [ ] Pantalla de inicio: logo centrado, slogan en una sola línea, responsive en móvil
- [ ] Bolitas tienen armas (espada / cuchillo / tijeras / pistola)
- [ ] Manchas de sangre se acumulan en el suelo del ring
- [ ] Al salir del ring: animación de smash + partículas
- [ ] Sonido de choque metálico al colisionar
- [ ] Grito al caer del ring
- [ ] Sonido de salpicadura de sangre

---

## Deploy a producción

> **Netlify cobra 15 créditos por cada deploy de producción.**
> No hacer deploy en cada cambio. Solo cuando las pruebas locales pasen completas.

### Flujo recomendado

1. Probar todos los cambios en `http://localhost:5173` (ver checklist arriba)
2. Hacer commit y push a `main`:
   ```bash
   git add -A
   git commit -m "descripción del cambio"
   git push
   ```
3. Render (backend) se despliega **automáticamente** con cada push — sin costo adicional
4. Netlify (frontend) **NO se despliega automáticamente** (auto-deploy desactivado)
5. Cuando el frontend esté listo para producción, ir a Netlify → **Deploys → Trigger deploy → Deploy site**

### Por qué el deploy manual en Netlify

Netlify tiene un límite de **300 créditos/mes** en el plan gratuito. Cada deploy de producción cuesta **15 créditos** = máximo 20 deploys al mes. Con deploys automáticos en cada commit, los créditos se agotan en un día de desarrollo activo.

**Render no tiene este problema** — los deploys del servidor son gratuitos e ilimitados.

---

## Deploy inicial (primera vez)

### Netlify (cliente)
1. Conecta el repo en [netlify.com](https://netlify.com)
2. Base dir: `client` → Build: `npm run build` → Publish: `dist`
3. Env var: `VITE_SERVER_URL=https://tu-app.onrender.com`
4. **Desactivar auto-deploy**: Site configuration → Build & deploy → Continuous Deployment → **Stop builds**

### Render (servidor)
1. Conecta el repo en [render.com](https://render.com)
2. Root directory: `server` → Build: `npm install && npm run build` → Start: `npm start`
3. Env vars requeridas:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `CLIENT_ORIGIN` | URL de Netlify |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | **service_role key** (no la anon key) |

---

## Variables de entorno

### server/.env
```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service_role key, NO la anon key
```

### client/.env
```
VITE_SERVER_URL=http://localhost:3001
```

---

## Privacidad

- Los jugadores no tienen nombre ni cuenta
- Solo se guarda: pregunta, respuestas, conteo por equipo y ganador
- No se almacena qué individuo eligió qué respuesta
