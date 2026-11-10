# Prototipo de Asistente Inteligente para la Recomendación Personalizada de Videojuegos (PC)

[![Node.js Version](https://img.shields.io/badge/Node.js-v24.11.1-green.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://react.dev/)
[![Express Version](https://img.shields.io/badge/Express-4.21.2-lightgrey.svg)](https://expressjs.com/)
[![MongoDB Version](https://img.shields.io/badge/MongoDB-Mongoose%208.12-brightgreen.svg)](https://mongoosejs.com/)
[![Test Suite](https://img.shields.io/badge/Tests-9%2F9%20Passing-success.svg)]()

> **Proyecto de Investigación Académica:**  
> *“Diseño de un prototipo de asistente inteligente para la recomendación personalizada de videojuegos”*

---

## 1. Contexto Académico del Proyecto

### Pregunta de Investigación
> *“¿Cómo podríamos diseñar un prototipo de asistente inteligente que recomiende videojuegos de forma realmente personalizada, considerando no solo lo que el jugador hace, sino también cómo se siente y qué necesita en ese momento?”*

### Objetivo General
Diseñar un prototipo de asistente inteligente para la recomendación personalizada de videojuegos, basado en el análisis de características emocionales, contextuales y de preferencia del jugador.

### Objetivos Específicos
1. Identificar los factores emocionales, conductuales y contextuales que influyen en la elección de videojuegos por parte de los jugadores.
2. Analizar modelos existentes de recomendación inteligente aplicados a contenidos interactivos.
3. Diseñar una arquitectura de asistente inteligente que integre criterios de personalización para recomendar videojuegos.

### Principio de Privacidad y Ética
El asistente **no diagnostica estados psicológicos ni emplea cámaras, micrófonos o vigilancia biométrica**. La dimensión emocional se fundamenta exclusivamente en la **expresión voluntaria en lenguaje natural** por parte del jugador (ej. *"estoy cansado y quiero relajarme"* o *"busco un reto estimulante"*), tratándola como una preferencia contextual temporal y respetando su autonomía.

---

## 2. Arquitectura del Sistema

El sistema implementa una arquitectura **MERN en capas modulares**:

```
               [ Usuario (Jugador de PC) ]
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   FRONTEND (React 19)                  │
│  - Home Landing: Presentación y dimensiones del sistema│
│  - ChatBot UI: Flujo conversacional y scroll reactivo  │
│  - GameCard: Tarjetas con afinidad, badges y porqués   │
│  - QuickReplies: Botones contextuales de respuesta     │
└────────────────────────────────────────────────────────┘
                  HTTP REST (Axios)
                           │  
                           ▼
┌────────────────────────────────────────────────────────┐
│              BACKEND API (Node.js + Express)           │
│  - NLP Service: Extracción de entidades e intenciones  │
│  - Recommender Engine: Puntuación multicriterio MCDA   │
│  - Explanation Service: Justificaciones transparentes  │
│  - Controllers & Routes: /api/recommendations & /games │
└────────────────────────────────────────────────────────┘
                     Mongoose ODM
                           │  
                           ▼
┌────────────────────────────────────────────────────────┐
│                   BASE DE DATOS (MongoDB)              │
│  - Colección 'games': 27 títulos verificados para PC   │
│  - Colección 'chats': Preguntas y respuestas FAQ       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Modelo Matemático del Motor de Recomendación

Para evitar sistemas "caja negra" inescrutables, el motor implementa un algoritmo **multicriterio determinista, auditable y ponderado con Normalización Dinámica de Pesos**:

Para cada videojuego $g$ y perfil de criterios extraído $P$:

$$\text{Score}(g) = \left( \sum_{c \in C_{\text{activos}}} w_c' \cdot S_c(g, P) \right) + \text{Bonus}_{\text{similar}} - \text{Penalización}_{\text{dislikes}}$$

Donde:
- $w_c' = \frac{w_c}{\sum_{k \in C_{\text{activos}}} w_k}$ (normaliza los pesos entre los criterios que el usuario efectivamente mencionó).
- $S_{\text{emoción}}$: afinidad semántica con el contexto emocional voluntario (relajación, reto, desconexión, historia).
- $S_{\text{tiempo}}$: correspondencia con la duración de sesión ($< 30\text{ min}$, $30\text{-}60\text{ min}$, $> 1\text{ h}$).
- $S_{\text{modo}}$: compatibilidad con modalidad requerida (individual, cooperativo con amigos).
- $S_{\text{género}}$: cobertura de los géneros predilectos.
- **Filtro de Exclusión Estricto:** Si el juego pertenece a un género que el usuario declaró que le desagrada (*"no me gusta el terror"*), el título queda automáticamente excluido de las recomendaciones.

---

## 4. Estructura del Repositorio

```
chatbot videojuegos/
├── README.md                       # Documentación integral del proyecto
├── .gitignore                      # Reglas de exclusión de dependencias y secretos
├── backend/
│   ├── .env                        # Variables de entorno locales
│   ├── .env.example                # Plantilla de configuración
│   ├── server.js                   # Punto de entrada de la API Express
│   ├── package.json                # Scripts y dependencias backend
│   ├── config/
│   │   └── db.js                   # Conexión Mongoose a MongoDB
│   ├── data/
│   │   ├── seedGames.json          # Dataset de 27 videojuegos de PC verificados
│   │   └── seedRunner.js           # Script de población de la base de datos
│   ├── models/
│   │   ├── Game.js                 # Esquema de datos de videojuegos
│   │   └── chat.js                 # Esquema de preguntas y respuestas FAQ
│   ├── services/
│   │   ├── nlpService.js           # Procesamiento de lenguaje natural en español
│   │   ├── recommendationEngine.js # Algoritmo de puntuación multicriterio
│   │   └── explanationService.js   # Generación de justificaciones transparentes
│   ├── controllers/
│   │   ├── recommendationController.js # Controlador conversacional y evaluador
│   │   ├── gameController.js       # Consultas y filtros del catálogo
│   │   └── chatcontroller.js       # Gestión de FAQ tradicional
│   ├── routes/
│   │   ├── recommendationRoutes.js # /api/recommendations/chat y /evaluate
│   │   ├── gameRoutes.js           # /api/games y /genres
│   │   └── chatroutes.js           # /api/chats
│   └── test/
│       ├── testRecommendations.js  # Pruebas del motor de recomendación
│       ├── testNLPAndChat.js       # Pruebas de extracción y diálogo NLP
│       └── testEndpoint.js         # Prueba HTTP del endpoint conversacional
└── frontend/
    ├── package.json                # Scripts y dependencias de React
    ├── .env                        # Variable REACT_APP_API_URL
    ├── .env.example                # Plantilla de variables frontend
    └── src/
        ├── App.js                  # Enrutador principal (React Router DOM)
        ├── Pages/
        │   ├── home.js             # Portada de bienvenida y dimensiones
        │   ├── chat.js             # Vista contenedora del chat
        │   └── Pages.css           # Estilos de las vistas principales
        └── components/
            ├── chatbot.js          # Componente conversacional interactivo
            ├── ChatBot.css         # Estilos del chat, burbujas y animaciones
            ├── GameCard.js         # Tarjetas de videojuegos recomendados
            ├── GameCard.css        # Estilos de tarjetas, imágenes y badges
            ├── QuickReplies.js     # Botones de sugerencias rápidas
            ├── QuickReplies.css    # Estilos de píldoras clicables
            └── addquestions.js     # Formulario de administración FAQ
```

---

## 5. Instrucciones de Instalación y Ejecución

### Prerrequisitos
- **Node.js** (v18 o superior; probado en v24.11.1).
- **MongoDB** (Servicio local en ejecución en el puerto por defecto `27017`).

---

### Paso 1: Configurar y Levantar el Backend

1. Abre una terminal y dirígete a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instala las dependencias (si no están instaladas):
   ```bash
   npm install
   ```
3. Poblar la base de datos con el catálogo inicial de videojuegos:
   ```bash
   npm run seed
   ```
   *(Verás el mensaje confirmando la inserción de 27 títulos para PC).*

4. Ejecutar la batería de pruebas automatizadas:
   ```bash
   npm test
   ```
   *(Verás las 9 pruebas de recomendación y NLP pasando al 100%).*

5. Iniciar el servidor API:
   ```bash
   npm start
   ```
   *(El servidor iniciará en el puerto 5000: `http://127.0.0.1:5000`).*

---

### Paso 2: Configurar y Levantar el Frontend

1. Abre una segunda terminal y dirígete a la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia la aplicación React:
   ```bash
   npm start
   ```
   *(La aplicación se abrirá automáticamente en tu navegador en `http://localhost:3000`).*

---

## 6. Ejemplos de Interacción para Pruebas del Prototipo

Puedes probar la capacidad del asistente conversacional introduciendo las siguientes frases:

| Caso de Uso | Mensaje de Prueba | Comportamiento Esperado |
| :--- | :--- | :--- |
| **Jugador agotado / Tiempo corto** | *"Hoy estuve todo el día trabajando y estoy agotado, solo tengo 30 minutos y quiero jugar solo"* | Recomienda *Dorfromantik*, *A Short Hike* y *Gris* (100% afinidad), justificando el bajo estrés y la duración corta. |
| **Jugador buscando reto y acción** | *"Quiero algo difícil y con mucha adrenalina para partidas rápidas"* | Recomienda *Hades* y *Dead Cells*, explicando la intensidad mecánica y el desafío estimulante. |
| **Jugar con amigos en cooperativo** | *"Busco un juego para jugar con mis amigos por la noche"* | Recomienda *It Takes Two*, *Portal 2* y *Deep Rock Galactic*, descartando títulos exclusivos para un solo jugador. |
| **Creatividad / Afinidad a Minecraft** | *"Quiero un juego parecido a Minecraft pero que no sea de terror"* | Recomienda *Minecraft*, *Terraria* y *Subnautica*, asegurando que títulos de terror o shooters queden excluidos. |
| **Solicitud ambigua / Vaga** | *"Quiero jugar algo"* | El asistente no adivina al azar: formula preguntas guía de apoyo y presenta sugerencias rápidas en botones. |
| **Diálogo multi-turno progresivo** | Turno 1: *"Busco un juego de aventura"*<br>Turno 2: *"Tengo 1 hora y quiero buena historia"* | Acumula los criterios entre turnos recomendando *Firewatch* y *Outer Wilds*. |

---

## 7. Protocolo para Validación de Usabilidad con Jugadores de PC

Para la etapa de pruebas de campo con usuarios:
1. **Tarea 1:** Pedir al jugador que busque un videojuego para relajarse tras una jornada pesada.
2. **Tarea 2:** Pedir al jugador que busque un título cooperativo para jugar con un amigo con poco tiempo disponible.
3. **Tarea 3:** Solicitarle que exprese un desagrado explícito (ej. rechazo a juegos de disparos) y verificar si el recomendador respeta su restricción.
4. **Cuestionario post-tarea:**
   - Pertinencia de las recomendaciones (Escala Likert 1-5).
   - Claridad de la explicación de *"¿Por qué te lo recomendamos?"*.
   - Facilidad de interacción mediante lenguaje natural en comparación con filtros tradicionales de tiendas.
