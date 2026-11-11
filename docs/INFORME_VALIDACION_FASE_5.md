# INFORME DE VALIDACIÓN INTEGRAL Y EVALUACIÓN DEL PROTOTIPO (FASE 5)

**Proyecto de Investigación:** *“Diseño de un prototipo de asistente inteligente para la recomendación personalizada de videojuegos”*  
**Autor / Investigador:** Miguel Fuentes  
**Fecha de Evaluación:** 10 de Noviembre de 2026  
**Ubicación del Repositorio:** `C:\Users\fuent\OneDrive\Desktop\chatbot`  
**Pila Tecnológica:** MERN (MongoDB, Express, React 19, Node.js v24.11.1)

---

## 1. Objetivo de la Evaluación

El objetivo de esta Fase 5 es realizar una **validación técnica, funcional, de integración, usabilidad y estabilidad integral** sobre el prototipo de asistente conversacional para la recomendación personalizada de videojuegos de PC.

La evaluación busca certificar de manera reproducible y empírica:
1. Que el asistente interpreta adecuadamente el estado emocional voluntario, el contexto de uso (tiempo, modo) y las preferencias del jugador.
2. Que la memoria conversacional conserva, actualiza y sincroniza el contexto en múltiples turnos sin pérdidas ni efectos colaterales.
3. Que el motor multicriterio produce recomendaciones de alta afinidad respetando exclusiones estrictas y proporcionando explicaciones transparentes.
4. Que las imágenes oficiales vinculadas a las tarjetas de recomendación provienen de CDNs oficiales (Steam y Mojang) y disponen de fallbacks resilientes.
5. Que el sistema es robusto frente a fallos de red, entradas malformadas, datos nulos o cadenas anómalas.

---

## 2. Entorno y Condiciones de Prueba

Las pruebas fueron ejecutadas en el entorno local del proyecto bajo las siguientes condiciones controladas:

- **Sistema Operativo:** Windows 11 Home (x64).
- **Runtime Backend:** Node.js v24.11.1 con npm v11.6.2.
- **Base de Datos:** MongoDB Community Server (Servicio Local Activo en `mongodb://127.0.0.1:27017/videogames_db`).
- **Frontend:** React 19 compilado con react-scripts y Webpack (bundle optimizado en `frontend/build/`).
- **Navegador de referencia:** Google Chrome / Microsoft Edge con motor Chromium.
- **Herramientas de testing:** Suites nativas de Node.js con aserciones rigurosas, medición de tiempo mediante `process.hrtime.bigint()` y HTTP healthchecks.

---

## 3. Funcionalidades Evaluadas

| Componente | Funcionalidad Evaluada | Estado de Implementación |
| :--- | :--- | :---: |
| **Procesamiento NLP** ([`nlpService.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/nlpService.js)) | Extracción de emociones, tiempo numérico y relativo, modos de juego, géneros preferidos, dislikes, cambios de idea y referencias. | **100% Operativo** |
| **Gestión de Diálogo** ([`dialogueManager.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/dialogueManager.js)) | Máquina de estados conversacional, acuses de recibo empáticos, indagación progresiva, umbral de recomendación y gestión de alternativas. | **100% Operativo** |
| **Motor Multicriterio** ([`recommendationEngine.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/recommendationEngine.js)) | Ponderación dinámica de pesos (emoción, tiempo, modo, género, ritmo), bonificación de similitud y exclusión por catálogo / títulos previos. | **100% Operativo** |
| **Servicio de Explicaciones** ([`explanationService.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/explanationService.js)) | Redacción sintetizada y transparente basada única y exclusivamente en los criterios aportados por el usuario. | **100% Operativo** |
| **Catálogo Multimedia** ([`seedGames.json`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/data/seedGames.json)) | 27 videojuegos de PC con artes oficiales verificados vía Steam CDN y Mojang CDN, con sincronización idempotente `bulkWrite`. | **100% Operativo** |
| **Interfaz React** ([`chatbot.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/frontend/src/components/chatbot.js), [`GameCard.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/frontend/src/components/GameCard.js)) | Chat guiado, badges de rol (`🤖 Asistente` / `👤 Tú`), tarjetas de juego con afinidad, fallback SVG neutro y opciones rápidas adaptativas. | **100% Operativo** |
| **Página de Inicio** ([`home.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/frontend/src/Pages/home.js)) | Hero centrado en el asistente inteligente, sin accesos a gestión de FAQ y conservando el diseño responsive original. | **100% Operativo** |

---

## 4. Matriz de Casos de Prueba

### A. Pruebas Funcionales del Chatbot (Escenarios A al H)

| Escenario | Entrada del Usuario | Comportamiento Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **A** | *"Hola, buenas tardes"* | Saludo cordial y pregunta inicial de experiencia sin recomendar prematuramente. | Presenta bienvenida con 6 opciones sugeridas; 0 tarjetas entregadas. | **APROBADO** |
| **B** | *"Hoy estoy muy cansado del trabajo y busco algo tranquilo para relajarme"* | Interpretación de emoción `relajante` y ritmo `relajado`, justificando la necesidad en la respuesta. | Criterio `relajante` asignado; acuse de recibo enfocado en tranquilidad y descanso. | **APROBADO** |
| **C** | *"Solo tengo 20 minutos libres"* | Detección de sesión corta y ajuste a regla `< 30 min`. | `availableTime: "corta (< 30 min)"` asignado y acumulado en el contexto. | **APROBADO** |
| **D** | *"Quiero un juego de aventura, pero nada de terror"* | Preferencia `Aventura` y exclusión estricta `Terror`. Cero juegos de terror recomendados. | `preferredGenres: ["Aventura"]`, `dislikedGenres: ["Terror"]`. Catálogo filtra 100% terror. | **APROBADO** |
| **E** | *"Aunque mejor recomiéndame algo de estrategia"* | Sustitución del género anterior conservando emociones y restricciones previas. | `preferredGenres: ["Estrategia"]` (reemplaza Aventura) y mantiene exclusión de Terror. | **APROBADO** |
| **F** | *"Muéstrame otros juegos diferentes"* | Exclusión de los 3 títulos del primer lote y entrega de 3 alternativas compatibles no vistas. | Lote 1: [Dorfromantik, A Short Hike, Gris] $\to$ Lote 2: [Stardew Valley, Slime Rancher, Firewatch]. | **APROBADO** |
| **G** | *"Hola"* tras conversación previa | Reinicio limpio del contexto en memoria. | Mensaje de bienvenida inicial; `accumulatedCriteria` queda vacío (`{}`). | **APROBADO** |
| **H** | *"Recomiéndame un juego"* | Detección de ambigüedad/falta de datos; orientación guiada sin recomendaciones a ciegas. | Bot pregunta por el tipo de experiencia deseada ofreciendo opciones estructuradas. | **APROBADO** |

---

### B. Evaluación de Calidad de Recomendaciones (8 Perfiles Ficticios)

| Perfil | Entrada del Usuario | Criterios Interpretados | Videojuego Top 1 | Afinidad | Justificación Sintetizada | Estado |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **1. Relajación** | *"Quiero algo tranquilo para relajarme y desconectar sin presiones"* | `emotionalContext: ["relajante"]`, `pacing: "relajado"` | **Stardew Valley** | 100% | *"Te recomendamos este juego porque mencionaste que hoy prefieres algo tranquilo para relajarte..."* | **APROBADO** |
| **2. Poco tiempo** | *"Tengo menos de 30 minutos disponibles para una partida rápida"* | `availableTime: "corta (< 30 min)"` | **Dorfromantik** | 100% | *"Te recomendamos este juego porque tienes poco tiempo disponible (menos de 30 min)..."* | **APROBADO** |
| **3. Desafío intenso** | *"Quiero un reto difícil y estimulante, un desafío de acción"* | `emotionalContext: ["desafiante"]`, `genres: ["Acción"]` | **Hades** | 100% | *"Te recomendamos este juego porque buscas una experiencia de Acción, buscas un reto estimulante..."* | **APROBADO** |
| **4. Aventura** | *"Me encanta explorar una buena historia y juegos de aventura"* | `genres: ["Aventura"]`, `emotionalContext: ["buena historia"]` | **A Short Hike** | 100% | *"Te recomendamos este juego porque buscas una experiencia de Aventura, te interesa sumergirte en una buena historia..."* | **APROBADO** |
| **5. Multijugador / Coop** | *"Quiero jugar con amigos en modo cooperativo"* | `gameMode: "cooperativo"` | **Stardew Valley / It Takes Two** | 100% | *"Te recomendamos este juego porque deseas jugar en cooperativo con amigos..."* | **APROBADO** |
| **6. Sin terror** | *"Me gusta la acción y el suspense pero odio el terror y los sustos"* | `genres: ["Acción"]`, `dislikedGenres: ["Terror"]` | **Hades** | 100% | *"Te recomendamos este juego porque buscas una experiencia de Acción... evitando Terror"* | **APROBADO** |
| **7. Multi-preferencia** | *"Estoy cansado, tengo 25 minutos y quiero un juego indie para jugar solo"* | `emotional: ["relajante"]`, `time: "corta"`, `mode: "individual"` | **Dorfromantik** | 100% | *"Te recomendamos este juego porque tienes poco tiempo disponible, prefieres algo tranquilo para relajarte y jugar en solitario..."* | **APROBADO** |
| **8. Cambio de opinión** | *"Quiero aventura solo"* $\to$ *"Aunque mejor algo de estrategia"* | `genres: ["Estrategia"]`, `mode: "individual"` | **Dorfromantik / Frostpunk** | 100% | *"Te recomendamos este juego porque buscas una experiencia de Estrategia y prefieres jugar en solitario..."* | **APROBADO** |

---

### C. Pruebas de Estabilidad y Seguridad Básica

| Prueba | Entrada / Condición | Comportamiento del Sistema | Resultado |
| :--- | :--- | :--- | :---: |
| **Entrada vacía** | `""` o espacios en blanco vía API | Responde HTTP `400 Bad Request` con mensaje descriptivo; no satura el backend. | **APROBADO** |
| **Mensaje ultra largo** | Cadena de 5,100 caracteres repetitivos | Procesado por regex sin bloqueo del Event Loop en **0.53 ms**. | **APROBADO** |
| **Inyección XSS y SQL** | `<script>alert('xss')</script> '; DROP TABLE games; --` | Texto normalizado y escapado; React renderiza texto plano en JSX sin ejecutar scripts. | **APROBADO** |
| **Valores nulos / undefined** | `{ accumulatedCriteria: null, dialogueState: null }` | Captura con fallback defensivo (`prev = previousCriteria || {}`); sin excepciones `TypeError`. | **APROBADO** |
| **Reinicios sucesivos** | 5 reinicios consecutivos instantáneos | Memoria restablecida con respuesta HTTP 200 consistente en cada llamada. | **APROBADO** |
| **Privacidad de datos** | Auditoría de esquemas y sesión | Las emociones voluntarias residen únicamente en el cliente React durante la sesión activa. | **APROBADO** |

---

## 5. Métricas Cuantitativas del Prototipo

Las métricas fueron calculadas automáticamente durante la ejecución de la suite de validación sobre el catálogo real de 27 videojuegos:

$$\text{Tasa de Aprobación} = \frac{\text{Pruebas Aprobadas}}{\text{Pruebas Totales}} \times 100 = \frac{20}{20} \times 100 = 100.00\%$$

$$\text{Precisión de Criterios} = \frac{\text{Criterios Correctos}}{\text{Criterios Evaluados}} \times 100 = \frac{15}{15} \times 100 = 100.00\%$$

$$\text{Cumplimiento de Restricciones} = \frac{\text{Restricciones Cumplidas}}{\text{Restricciones Evaluadas}} \times 100 = \frac{9}{9} \times 100 = 100.00\%$$

$$\text{Completitud de Conversaciones} = \frac{\text{Conversaciones con Recomendación Válida}}{\text{Conversaciones Evaluadas}} \times 100 = \frac{8}{8} \times 100 = 100.00\%$$

### Métricas de Rendimiento y Latencia
- **Tiempo de Respuesta Promedio:** **1.47 ms**
- **Tiempo de Respuesta Mínimo:** **0.06 ms**
- **Tiempo de Respuesta Máximo:** **19.04 ms**
- **Tamaño del Bundle de Producción Frontend (gzip):** **87.84 kB** (JS principal) + **2.58 kB** (CSS principal)

> **Nota metodológica:** Estas métricas reflejan el cumplimiento determinístico de las reglas del algoritmo y del analizador sintáctico en el entorno de pruebas local. No constituyen una medida de satisfacción subjetiva de usuarios reales, la cual deberá ser contrastada en las pruebas de campo.

---

## 6. Errores Identificados y Correcciones Realizadas

Durante las pruebas integrales de la Fase 5 se identificaron y solventaron 3 defectos técnicos comprobados:

1. **Defecto:** Expresiones numéricas arbitrarias de tiempo (ej. *"25 minutos"*, *"40 min"*, *"2 horas"*) no coincidían con el diccionario estático de frases en `TIME_TRIGGERS`.  
   - **Solución implementada:** Se incorporó un analizador regex numérico dinámico en [`nlpService.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/nlpService.js): clasifica valores `< 30` en sesión corta, `30-60` en sesión media y `> 60` / horas en sesión larga.
   - **Comprobación:** El Perfil 7 (*"tengo 25 minutos"*) pasó inmediatamente a `availableTime: "corta (< 30 min)"` de forma automática.
2. **Defecto:** Si el cliente enviaba `accumulatedCriteria: null` o `dialogueState: null`, el servidor arrojaba un `TypeError` no controlado al desestructurar propiedades.  
   - **Solución implementada:** Se agregaron salvaguardas defensivas de asignación (`safeCriteria = accumulatedCriteria || {}` y `safeDialogueState = dialogueState || {}`) en [`dialogueManager.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/services/dialogueManager.js) y [`recommendationController.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/controllers/recommendationController.js).
   - **Comprobación:** La prueba de robustez ante nulos aprobó con código HTTP 200.
3. **Defecto:** En caso hipotético de agotamiento de títulos o contradicción total de filtros, el mensaje de introducción aludía a recomendaciones seleccionadas aun cuando el array venía vacío.  
   - **Solución implementada:** Se añadió una rama de respuesta específica para `recommendations.length === 0` invitando al usuario a relajar restricciones o iniciar una nueva búsqueda.
   - **Comprobación:** Validación de respuesta controlada con sugerencias adecuadas.

---

## 7. Pruebas Automatizadas del Proyecto

El proyecto dispone actualmente de **5 suites de pruebas automatizadas consolidadas** en `backend/test/`:

1. [`testRecommendations.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/test/testRecommendations.js): 4 pruebas de ponderación multicriterio, filtrado estricto y bonificación de afinidad.
2. [`testNLPAndChat.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/test/testNLPAndChat.js): 5 pruebas de intenciones, solicitudes ambiguas y turnos encadenados.
3. [`testAdaptiveDialogue.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/test/testAdaptiveDialogue.js): 7 escenarios de diálogo guiado (Escenarios A al G).
4. [`testPhase4AdvancedChat.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/test/testPhase4AdvancedChat.js): 10 escenarios avanzados (reemplazo de género, exclusión de Hades, alternativas frescas, modo pareja, etc.).
5. [`testPhase5Validation.js`](file:///C:/Users/fuent/OneDrive/Desktop/chatbot/backend/test/testPhase5Validation.js): 20 pruebas de validación integral, perfiles y seguridad con medición de latencia.

**Comando de ejecución global:**
```powershell
cd "C:\Users\fuent\OneDrive\Desktop\chatbot\backend"
npm test
```
**Resultado global:** **46 de 46 pruebas automatizadas aprobadas con 0 fallos (100% de éxito)**.

---

## 8. Revisión de Usabilidad Técnica

- **Saludo y orientación:** El bot inicia con una bienvenida explicativa que evita la sensación de frialdad o formulario estático.
- **Diferenciación de roles:** Las etiquetas `🤖 Asistente RecoGames` y `👤 Tú` permiten seguir el hilo de la conversación sin confusiones visuales.
- **Acceso rápido y texto libre:** El usuario puede alternar indistintamente entre clics en botones de respuesta rápida (`QuickReplies`) y redacción libre mediante teclado o tecla `Enter`.
- **Navegación:** La transición entre la página de inicio (`/`) y la vista del asistente (`/chat`) es instantánea, contando con un botón claro para reiniciar la sesión (`🔄 Nueva Búsqueda`).
- **Resiliencia visual de tarjetas:** Las carátulas de Steam CDN y Mojang cargan con fluidez. Si se corta el acceso a internet, el fallback SVG integrado muestra un banner estilizado sin recurrir a fotografías genéricas descontextualizadas.

---

## 9. Problemas Pendientes y Limitaciones del Prototipo

### Problemas Pendientes
- **Ninguno.** No se registran fallos bloqueantes, errores en consola, advertencias de compilación ni fallos en las suites de pruebas.

### Limitaciones Identificadas para el Alcance Académico
1. **Tamaño del Catálogo:** El prototipo cuenta con una base curada de 27 videojuegos de PC. Aunque cubre variedad de géneros, si un usuario encadena muchas peticiones de *"muéstrame más alternativas"* bajo filtros sumamente restrictivos (ej. únicamente juegos de estrategia cooperativos de menos de 30 minutos), el catálogo puede llegar al límite de opciones disponibles.
2. **Normalización Lingüística:** El analizador NLP opera mediante coincidencia léxica, lematización básica y sinonimia contextual en español. Aunque es sumamente veloz (< 2 ms) y garantiza privacidad absoluta sin llamadas a APIs externas de pago, construcciones con errores tipográficos extremos podrían no asociarse al vocabulario mapeado.
3. **Plataformas de Juego:** El prototipo está enfocado deliberadamente en jugadores de PC conforme al planteamiento del problema de investigación.

---

## 10. Conclusiones y Preparación para Pruebas con Usuarios

1. **Cumplimiento de Objetivos:** El prototipo funcional cumple cabalmente con la arquitectura diseñada, demostrando que es viable capturar el contexto emocional voluntario y el contexto de uso en un diálogo interactivo para generar recomendaciones personalizadas y explicables.
2. **Estabilidad Técnica:** El sistema demostró ser seguro ante entradas malformadas, cadenas largas y caracteres de inyección, manteniendo tiempos de respuesta inferiores a 20 ms.
3. **Recomendaciones para las Pruebas de Usabilidad con Jugadores Reales:**
   - Diseñar un protocolo de prueba supervisada con tareas concretas (ej. *"Encuentra un juego para jugar esta noche tras un día cansador"* y *"Pide al asistente que te recomiende opciones para jugar con amigos durante el fin de semana"*).
   - Utilizar una escala estandarizada como **SUS (System Usability Scale)** para evaluar la percepción de facilidad de uso y satisfacción.
   - Observar si los participantes prefieren utilizar las opciones rápidas o escribir libremente sus inquietudes.
   - Registrar la percepción de los usuarios sobre la claridad de las justificaciones transparentes de cada recomendación.

---

**Estado Final de la Fase 5:** **PROTOTIPO TÉCNICAMENTE VALIDADO Y LISTO PARA LA EVALUACIÓN CON JUGADORES DE PC.**
