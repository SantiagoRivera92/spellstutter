# Spellstutter

[English](README.md) | **Español**

**Un constructor de mazos y rastreador del metagame centrado en Pauper para Magic: The Gathering.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

Spellstutter combina un catálogo completo de cartas, un editor de mazos con
arrastrar y soltar y datos del metagame de Pauper actualizados a diario en una
sola aplicación. Crea y organiza mazos, consulta todas las impresiones de cada
carta y descubre qué arquetipos y cartas están ganando de verdad.

> Contenido de fans no oficial permitido por la Política de Contenido de Fans de
> Wizards of the Coast. Magic: The Gathering es una marca registrada de Wizards
> of the Coast LLC. Datos de cartas de Scryfall.

## Características

- **Catálogo completo de cartas** — todas las cartas y todas sus impresiones,
  sincronizadas desde la API masiva de Scryfall. Busca con toda la sintaxis de
  Scryfall y consulta la legalidad en todos los formatos, mientras que la
  construcción de mazos se limita a Pauper.
- **Editor de mazos** — arrastra cartas, elige cualquier impresión, importa
  listas en texto, exporta como texto plano o archivo `.dek` de MTGO, y crea un
  mazo a partir del núcleo de un arquetipo.
- **Biblioteca y carpetas** — un árbol de carpetas anidado, arte de portada,
  mazos públicos y comentarios por mazo.
- **Rastreador del metagame** — resultados diarios de ligas y challenges de MTGO
  de Pauper divididos en arquetipos según sus colores, con cuota del metagame,
  composición media, registros de enfrentamientos y rankings de cartas
  esenciales.
- **Segunda fuente de arquetipos** — listas de ejemplo y estadísticas de
  inclusión por carta de endstep.cc para construir mazos.
- **Cuentas y notificaciones** — Supabase Auth, perfiles, notificaciones de
  comentarios y respuestas, y seguridad a nivel de fila (RLS).

## Stack tecnológico

| Capa | Elección |
| --- | --- |
| Aplicación | Next.js 16 App Router, React 19, Turbopack |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS v4 con tokens de diseño semánticos |
| Catálogo de cartas + metagame | MongoDB (Atlas en producción, Docker en local) |
| Cuentas, mazos, carpetas | Supabase Postgres + Auth + RLS |
| Sincronización de datos | GitHub Actions programadas que ejecutan scripts `tsx` |
| Iconos / arrastrar y soltar | lucide-react, arrastrar y soltar nativo de HTML5 |

## Arquitectura

```
Scryfall bulk API ───sync:cards────▶ MongoDB: cards, printings
mtgo.com decklists ──sync:metagame─▶ MongoDB: metagame_events, metagame_decks
endstep.cc API ──────sync:endstep──▶ MongoDB: endstep_archetypes, endstep_matchups
                                           │
                      Next.js (App Router) ─┼─▶ /api/cards/*, /api/scryfall/*
                                           └─▶ server components
Supabase Postgres ── profiles, folders, decks, deck_cards, comments, notifications (RLS)
```

Las lecturas de cartas y metagame pasan por helpers de Mongo solo para servidor
(`src/lib/cards/queries.ts`, `src/lib/metagame/queries.ts`). Las escrituras de
mazos pasan por server actions (`src/lib/decks/actions.ts`) que vuelven a
comprobar la legalidad en Pauper contra Mongo antes de insertar una carta.

## Primeros pasos

**Requisitos:** Node 22+, pnpm 11+ y Docker (u otra instancia de MongoDB). Se
necesita Supabase para cuentas, mazos y carpetas.

```bash
git clone <repository-url> spellstutter
cd spellstutter
pnpm install
cp .env.example .env.local
```

### 1. Iniciar MongoDB

```bash
docker compose up -d mongo
# sin el plugin de compose:
# docker run -d --name spellstutter-mongo -p 27017:27017 mongo:8
```

### 2. Configurar el entorno

Rellena `.env.local`. Como mínimo, define `MONGODB_URI`; añade los valores de
Supabase para la autenticación y el almacenamiento de mazos.

### 3. Aplicar el esquema de Supabase

Crea un proyecto de Supabase y ejecuta las migraciones en orden con la CLI de
Supabase o pégalas en el editor SQL:

```bash
supabase db push
```

<details>
<summary>Archivos de migración y configuración de auth</summary>

- `20260928120000_init.sql` — `profiles`, `folders`, `decks`, `deck_cards`,
  políticas RLS, la protección contra ciclos en carpetas y el trigger de registro
  que crea un perfil.
- `20260929120000_deck_archetype.sql` — `decks.archetype_slug` para mazos creados
  a partir de un arquetipo.
- `20260930120000_comments_notifications.sql` — `deck_comments` y
  `notifications`, RLS y el trigger de notificación de comentarios.
- `20260930130000_comment_insert_policy.sql` — permite que los usuarios
  autenticados comenten en mazos que pueden leer.

En Supabase → Authentication → URL configuration, añade
`http://localhost:3000/auth/callback` y la URL de callback de producción.
</details>

### 4. Cargar datos

```bash
# Catálogo de cartas (unas 118k impresiones / 38k cartas, ~200 MB en Mongo)
pnpm sync:cards -- --limit=2000   # carga local rápida; quita --limit para todo

# Metagame (mes UTC actual)
pnpm sync:metagame

# Arquetipos de endstep (opcional, se usan para crear mazos)
pnpm sync:endstep
```

Los índices de sincronización se crean automáticamente en la primera ejecución.

### 5. Ejecutar

```bash
pnpm dev
```

Abre <http://localhost:3000>. Sin `MONGODB_URI`, las páginas de cartas y metagame
muestran un aviso de configuración en lugar de fallar.

## Flujo de datos

| Comando | Origen | Escribe en | Programación |
| --- | --- | --- | --- |
| `pnpm sync:cards` | API masiva de Scryfall | `cards`, `printings` | Diario, 04:17 UTC |
| `pnpm sync:metagame` | decklists de mtgo.com | `metagame_events`, `metagame_decks` | Diario, 05:23 UTC |
| `pnpm sync:endstep` | API de metagame de endstep.cc | `endstep_archetypes`, `endstep_matchups` | Diario, 06:37 UTC |
| `pnpm sync:reclassify` | solo mazos guardados | Recalcula arquetipo + color | Manual |

`sync:cards` procesa el archivo masivo JSONL comprimido de Scryfall y hace upsert
de un documento canónico por oracle id más uno por impresión. `sync:metagame` lee
el payload `window.MTGO.decklists.data` incrustado en cada página de decklist (sin
scraping del DOM) y clasifica cada lista con `src/lib/metagame/archetypes.ts`.

## GitHub Actions

Tres workflows se ejecutan a diario y se pueden lanzar manualmente desde la
pestaña Actions:

| Workflow | Comando | Programación |
| --- | --- | --- |
| `.github/workflows/sync-cards.yml` | `pnpm sync:cards` | 04:17 UTC |
| `.github/workflows/sync-metagame.yml` | `pnpm sync:metagame` | 05:23 UTC |
| `.github/workflows/sync-endstep.yml` | `pnpm sync:endstep` | 06:37 UTC |

Configura esto en el repositorio:

- **Secreto:** `MONGODB_URI`
- **Variables:** `MONGODB_DB`, `SCRYFALL_USER_AGENT`

Las ejecuciones manuales de los workflows de metagame y endstep aceptan entradas
opcionales como año/mes, formato, ventana y límites.

## Variables de entorno

| Nombre | Lo usa | Notas |
| --- | --- | --- |
| `MONGODB_URI` | App + todas las sincronizaciones | Cadena de conexión de Atlas o Mongo local |
| `MONGODB_DB` | App + todas las sincronizaciones | Por defecto, `spellstutter` |
| `NEXT_PUBLIC_SUPABASE_URL` | App | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App | Clave anon segura para el navegador |
| `NEXT_PUBLIC_SITE_URL` | App | Origen canónico para redirecciones de auth; obligatorio en producción |
| `SCRYFALL_USER_AGENT` | Sincronización de cartas | User-Agent descriptivo con datos de contacto |

## Scripts

| Comando | Propósito |
| --- | --- |
| `pnpm dev` | Inicia el servidor de desarrollo de Next.js |
| `pnpm build` / `pnpm start` | Build / servir en producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Tests unitarios (reglas de arquetipos, tipos de carta, sintaxis de búsqueda, redirecciones de auth, rate limiting, estadísticas de enfrentamientos) |
| `pnpm sync:cards` | Scryfall → Mongo |
| `pnpm sync:metagame` | MTGO → Mongo |
| `pnpm sync:reclassify` | Reaplica las reglas de arquetipos a los mazos guardados (sin red) |
| `pnpm sync:endstep` | Arquetipos de endstep.cc → Mongo (listas de ejemplo + estadísticas de cartas) |

## Estructura del proyecto

```
src/
  app/
    (auth)/            login, registro, recuperar/restablecer contraseña
    api/cards/         handlers de detalle de carta desde Mongo
    api/scryfall/      proxy de búsqueda de Scryfall
    cards/             búsqueda y páginas de detalle de cartas
    decks/             biblioteca, editor, mazos públicos
    events/            lista y detalle de eventos de MTGO
    metagame/          resumen, arquetipos, enfrentamientos
    notifications/     notificaciones de comentarios y respuestas
    staples/           rankings de cartas esenciales por categoría
    settings/profile/  perfil y avatar
    users/[username]/  perfiles públicos
  components/          primitivas de UI y componentes de funcionalidades
  lib/
    cards/             tipos, helpers de maná, parser de búsqueda, consultas a Mongo
    scryfall/          cliente de API y normalización (compartido con la sincronización)
    decks/             consultas, acciones, estadísticas, import/export
    metagame/          reglas de arquetipos, helpers de endstep, consultas
    auth/              sesión, redirecciones seguras, rate limiting
    supabase/          cliente de servidor y proxy de sesión
scripts/               sync-scryfall, scrape-metagame, sync-endstep, reclassify
supabase/migrations/   esquema de Postgres y RLS
```

## Cómo funciona

### Búsqueda de cartas y legalidad

La búsqueda consulta Scryfall a través de `/api/scryfall/search`
(`src/lib/scryfall/client.ts`), así que funciona toda la sintaxis de Scryfall y
cualquier carta es buscable, sea legal en Pauper o no. Los resultados incluyen la
legalidad en Pauper de Scryfall; la acción de añadir al mazo vuelve a comprobar
la legalidad contra el catálogo antes de escribir.

Las páginas de carta (`/cards/[oracleId]`) muestran la carta, todas sus
impresiones, la tabla completa de legalidad por formato y —para cartas legales en
Pauper— los arquetipos que la juegan con su tasa de inclusión y copias medias.

### Clasificación del metagame

Los mazos se agrupan comparando los nombres de las cartas del mainboard con una
tabla de reglas en `src/lib/metagame/archetypes.ts`. Las reglas también pueden
restringir la identidad de color (`requiresColors`, `excludesColors`,
`maxColors`) para dividir familias en mazos reales: Affinity en Esper / Grixis /
Jeskai / Four-Color, Terror en Mono-Blue / Izzet / Dimir, Madness en Monored /
Izzet / Rakdos, y Faeries en Dimir / Mono-Blue.

<details>
<summary>Reglas de clasificación y notas de ajuste</summary>

- Una carta obligatoria en `requires` separa mazos parecidos: cualquier base de
  artefactos que juegue Cleansing Wildfire es un mazo Wildfire, no Affinity.
- Dimir Faeries y Dimir Control comparten casi todo su removal y sus
  counterspells, así que la regla de Faeries exige una criatura de tempo
  (Spellstutter Sprite, Faerie Seer, Ninja of the Deep Hours, Moon-Circuit
  Hacker). Dimir Control se identifica por cartas que juega la versión de control
  pero no la de tempo.
- La clasificación usa solo los colores del mainboard, ya que los sideboards
  suelen incluir cartas de hate de otros colores.
- `IDENTITY_EXEMPT_CARDS` excluye cartas que son efectivamente gratis o que
  nunca se lanzan — Sneaky Snacker, Mutagenic Growth, Faerie Macabre — para que
  esos mazos no se malinterpreten como multicolor.
- Las listas que no coinciden con ninguna regla van a `Other`. Tras cambiar
  reglas, sube `CLASSIFICATION_VERSION` y ejecuta `pnpm sync:reclassify`; no hace
  falta volver a scrapear.

Las páginas de arquetipo muestran la cuota del metagame y la composición media:
copias medias por carta y el porcentaje de listas que la incluyen, con «Core»
marcando las cartas presentes en todas las listas. Al crear un mazo, se añade cada
carta con 100% de inclusión usando el menor número de copias que usó cualquier
lista.
</details>

### Arquetipos de endstep.cc

`pnpm sync:endstep` ingesta la API pública de metagame de endstep.cc
(`endstep.cc/api/metagame/v1`) en `endstep_archetypes`. Es una segunda fuente
independiente que se usa para **construir mazos**, no para resultados de partidas:
cada arquetipo incluye una lista de ejemplo canónica (`sample_list.main` /
`sample_list.side`), estadísticas de inclusión por carta (`cards_main` /
`cards_side`), cartas clave, colores y cuota/jugadores agregados.

<details>
<summary>Notas sobre endstep</summary>

```bash
pnpm sync:endstep                  # Pauper, ventana de 30d, población rated
pnpm sync:endstep -- --window=90d
pnpm sync:endstep -- --limit=20 --dry-run
pnpm sync:endstep -- --no-cards    # omite las estadísticas por carta
```

endstep oculta las listas de ejemplo y las tablas de cartas por debajo de un
tamaño mínimo de muestra, así que algunos documentos tienen `sample_list` /
`cards_*` vacíos. Los nombres de las cartas de ejemplo se resuelven a oracle ids
durante la sincronización (incluidas las caras frontales de DFC), así que crear
mazos no requiere búsquedas en tiempo de ejecución. Los helpers de lectura están
en `src/lib/metagame/endstep.ts`.

El selector «Seed an archetype» del diálogo de nuevo mazo lista ambas fuentes:
arquetipos de MTGO (slug tal cual) y arquetipos de endstep (slug con prefijo
`endstep:`).
</details>

### Notas de diseño

<details>
<summary>Decisiones de UI y accesibilidad</summary>

- UI dark-first con un tema claro completo y un toggle persistente. Los colores se
  consumen mediante tokens semánticos, nunca con rampas directas.
- Dos tipografías: Bricolage Grotesque (display) e Instrument Sans (cuerpo/UI).
- El movimiento está limitado (120 ms en hover, 240 ms en entradas) y se desactiva
  con `prefers-reduced-motion`.
- HTML semántico (listas de mazos en `table`, `dialog`, `details`, `nav`,
  controles etiquetados) y estados de foco visibles en toda la app.
</details>

### Limitaciones conocidas

<details>
<summary>Advertencias actuales</summary>

- El clasificador del metagame es heurístico (v4); combinaciones de colores poco
  comunes siguen cayendo en `Other` y la tabla de reglas necesita ajustes con el
  tiempo.
- La identidad de color del metagame proviene de los datos de color de las cartas
  de MTGO, que aproximan la identidad (no se resuelven tierras de color ni
  símbolos incoloros).
- `mtgo.com` sirve una página vacía a los User-Agents de bots, así que el scraper
  usa un User-Agent de navegador y limita la tasa de peticiones.
- A veces MTGO nombra las cartas de forma distinta a Scryfall (por ejemplo, el set
  digital «Through the Omenpaths», `om1`). Las equivalencias están en
  `src/lib/metagame/card-aliases.ts` y hay que ampliarlas a mano.
- El arte de avatares y portadas usa URLs del CDN de Scryfall; no hay espejo local
  de imágenes.
</details>

## Despliegue

Spellstutter es una app Next.js estándar y se puede desplegar en cualquier host de
Node compatible con Next.js 16 (por ejemplo, Vercel o una plataforma de
contenedores).

1. Define las variables de entorno anteriores en el host.
2. Define `NEXT_PUBLIC_SITE_URL` con el origen de producción; es obligatorio en
   producción.
3. Añade la URL `/auth/callback` de producción a las URLs de redirección de
   Supabase.
4. Apunta la app a un MongoDB (Atlas) y un proyecto de Supabase de producción.
5. Deja que los workflows programados mantengan el catálogo y el metagame al día,
   o ejecuta los comandos de sincronización desde tu propio scheduler.

## Contribuir

Las issues y pull requests son bienvenidas.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Antes de abrir un PR:

- Ejecuta lint, typecheck y los tests.
- Si cambias las reglas de arquetipos, sube `CLASSIFICATION_VERSION` y ejecuta
  `pnpm sync:reclassify` (o explica por qué no hace falta reclasificar).
- Mantén las comprobaciones de legalidad en el servidor; nunca confíes en la
  legalidad que envía el cliente.

## Fuentes de datos y atribución

- Datos de cartas de [Scryfall](https://scryfall.com).
- Resultados de ligas y challenges de Pauper de MTGO de
  [mtgo.com](https://www.mtgo.com).
- Listas de ejemplo y estadísticas de arquetipos de
  [endstep.cc](https://endstep.cc).

Spellstutter es contenido de fans no oficial permitido por la Política de
Contenido de Fans de Wizards of the Coast. Magic: The Gathering es una marca
registrada de Wizards of the Coast LLC.

## Licencia

Actualmente este repositorio no incluye ningún archivo de licencia.
