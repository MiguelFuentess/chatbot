/**
 * Servicio de Diversidad y Descubrimiento de Videojuegos (Etapa 4 - Tercera Evolución)
 *
 * Responsabilidades:
 * - Medición objetiva de similitud multidimensional entre pares de videojuegos (sin inventar datos).
 * - Selección diversa de recomendaciones mediante Relevancia Marginal Máxima (MMR) determinista.
 * - Configuración y normalización de modos de descubrimiento:
 *     - 'familiar': Prioriza videojuegos cercanos a los gustos conocidos (lambda = 0.85).
 *     - 'balanced': Combina afinidad alta con diversidad moderada (lambda = 0.65, por defecto).
 *     - 'exploratory': Aumenta la diversidad buscando experiencias distintas compatibles (lambda = 0.45).
 * - Tratamiento riguroso de metadatos nulos/desconocidos como neutros (0.50).
 * - Cálculo de métricas de diversidad intra-tanda (distancia media pairwise).
 * - Generación de explicaciones de contraste y variedad entre los títulos de la tanda.
 * - Conservación intacta de la afinidad individual calibrada de la Etapa 3.
 */

const PACING_LEVELS = {
    relajado: 0,
    moderado: 1,
    intenso: 2
}

const DURATION_LEVELS = {
    "corta (< 30 min)": 0,
    "media (30-60 min)": 1,
    "larga (> 1 hora)": 2
}

const DIFFICULTY_LEVELS = {
    baja: 0,
    media: 1,
    alta: 2
}

const EXPERIENCE_ATTRIBUTES = [
    "exploration",
    "narrative",
    "creativity",
    "strategy",
    "combat",
    "freedom",
    "complexity"
]

/**
 * Normaliza el modo de descubrimiento solicitado.
 * Mapea tanto los términos nuevos ('familiar', 'balanced', 'exploratory')
 * como los legados de etapas anteriores ('similar', 'indistinto', 'diferente').
 *
 * @param {string|null} mode Modo solicitado
 * @returns {string} 'familiar' | 'balanced' | 'exploratory'
 */
function normalizeDiscoveryMode(mode) {
    if (!mode || typeof mode !== "string") return "balanced"
    const clean = mode.toLowerCase().trim()

    if (clean === "familiar" || clean === "similar" || clean === "preciso" || clean === "precisas") {
        return "familiar"
    }
    if (clean === "exploratory" || clean === "exploratorio" || clean === "diferente" || clean === "descubrimiento" || clean === "nuevo" || clean === "variedad") {
        return "exploratory"
    }
    return "balanced"
}

/**
 * Devuelve los parámetros de configuración y balance para un modo de descubrimiento.
 *
 * @param {string} mode Modo de descubrimiento normalizado
 * @returns {Object} { lambda, name, label, description }
 */
function getDiscoveryConfig(mode) {
    const norm = normalizeDiscoveryMode(mode)
    switch (norm) {
        case "familiar":
            return {
                lambda: 0.85,
                name: "familiar",
                label: "Familiar (Alta afinidad)",
                description: "Prioriza videojuegos cercanos a tus preferencias y gustos conocidos."
            }
        case "exploratory":
            return {
                lambda: 0.45,
                name: "exploratory",
                label: "Exploratorio (Descubrimiento activo)",
                description: "Aumenta la variedad de experiencias dentro de las opciones compatibles."
            }
        case "balanced":
        default:
            return {
                lambda: 0.65,
                name: "balanced",
                label: "Equilibrado (Relevancia y variedad)",
                description: "Combina afinidad con diversidad entre las opciones de la tanda."
            }
    }
}

/**
 * Calcula el índice de similitud de Jaccard entre dos listas de cadenas (case-insensitive).
 *
 * @param {Array<string>} listA
 * @param {Array<string>} listB
 * @returns {number} Valor en [0.0, 1.0]
 */
function jaccardSimilarity(listA = [], listB = []) {
    if (!Array.isArray(listA) || !Array.isArray(listB)) return 0.5
    const setA = new Set(listA.map((item) => String(item).toLowerCase().trim()))
    const setB = new Set(listB.map((item) => String(item).toLowerCase().trim()))

    if (setA.size === 0 && setB.size === 0) return 0.5
    if (setA.size === 0 || setB.size === 0) return 0.0

    let intersectionSize = 0
    for (const item of setA) {
        if (setB.has(item)) intersectionSize++
    }

    const unionSize = setA.size + setB.size - intersectionSize
    return unionSize === 0 ? 0.0 : intersectionSize / unionSize
}

/**
 * Calcula la similitud ordinal normalizada entre dos niveles definidos en un diccionario.
 *
 * @param {string|null} valA
 * @param {string|null} valB
 * @param {Object} levelMap Mapeo de valores a enteros consecutivos [0..maxLevel]
 * @param {number} maxLevel Rango máximo
 * @returns {number} Valor en [0.0, 1.0]
 */
function ordinalSimilarity(valA, valB, levelMap, maxLevel = 2) {
    if (!valA || !valB) return 0.5 // Valor desconocido: neutro
    const cleanA = String(valA).toLowerCase().trim()
    const cleanB = String(valB).toLowerCase().trim()

    const lvlA = levelMap[cleanA]
    const lvlB = levelMap[cleanB]

    if (lvlA === undefined || lvlB === undefined) return 0.5
    const diff = Math.abs(lvlA - lvlB)
    return Math.max(0.0, 1.0 - diff / maxLevel)
}

/**
 * Calcula la similitud entre dos videojuegos utilizando atributos verificados del catálogo.
 *
 * Dimensiones evaluadas y sus pesos normalizados:
 * - Géneros (25%): Índice Jaccard de solapamiento temático.
 * - Atributos de Experiencia (30%): Distancia normalizada entre los 7 atributos continuos [0..5].
 * - Estilo de Objetivos (15%): Coincidencia estructural ('guiado', 'libre', 'mixto').
 * - Dificultad (10%): Distancia de desafío motriz/mental ('baja', 'media', 'alta', 'ajustable').
 * - Ritmo (10%): Distancia ordinal ('relajado', 'moderado', 'intenso').
 * - Duración de Sesión (5%): Distancia de tiempo de juego.
 * - Modalidades (5%): Índice Jaccard de modos admitidos.
 *
 * Garantías:
 * - Simétrica: Sim(A, B) === Sim(B, A).
 * - Identidad: Sim(A, A) === 1.0.
 * - Acotada: [0.0, 1.0].
 * - Imparcial: Atributos desconocidos se evalúan de forma neutral (0.50).
 *
 * @param {Object} gameA Videojuego A
 * @param {Object} gameB Videojuego B
 * @returns {number} Similitud en escala [0.0, 1.0]
 */
function calculateGameSimilarity(gameA, gameB) {
    if (!gameA || !gameB) return 0.0

    // 1. Identidad estricta
    const idA = gameA._id ? String(gameA._id) : (gameA.title || "").toLowerCase().trim()
    const idB = gameB._id ? String(gameB._id) : (gameB.title || "").toLowerCase().trim()
    if (idA && idB && idA === idB) {
        return 1.0
    }

    // 2. Similitud de Géneros (Jaccard)
    const genreSim = jaccardSimilarity(gameA.genres, gameB.genres)

    // 3. Similitud de Atributos de Experiencia ([0..5])
    const expA = gameA.experienceAttributes || {}
    const expB = gameB.experienceAttributes || {}
    let evaluatedExpCount = 0
    let expSimSum = 0

    for (const attr of EXPERIENCE_ATTRIBUTES) {
        const valA = expA[attr]
        const valB = expB[attr]

        if (valA !== null && valA !== undefined && valB !== null && valB !== undefined) {
            evaluatedExpCount++
            const diff = Math.abs(valA - valB)
            expSimSum += (1.0 - diff / 5.0)
        }
    }

    const expSim = evaluatedExpCount > 0 ? (expSimSum / evaluatedExpCount) : 0.5

    // 4. Similitud de Estilo de Objetivos
    let objectiveSim = 0.5
    if (gameA.objectiveStyle && gameB.objectiveStyle) {
        const objA = gameA.objectiveStyle.toLowerCase().trim()
        const objB = gameB.objectiveStyle.toLowerCase().trim()
        if (objA === objB) {
            objectiveSim = 1.0
        } else if (objA === "mixto" || objB === "mixto") {
            objectiveSim = 0.60
        } else {
            objectiveSim = 0.0 // Oposición directa entre 'guiado' y 'libre'
        }
    }

    // 5. Similitud de Dificultad
    let difficultySim = 0.5
    if (gameA.difficulty && gameB.difficulty) {
        const diffA = gameA.difficulty.toLowerCase().trim()
        const diffB = gameB.difficulty.toLowerCase().trim()
        if (diffA === diffB) {
            difficultySim = 1.0
        } else if (diffA === "ajustable" || diffB === "ajustable") {
            difficultySim = 0.75 // 'ajustable' tiene alta compatibilidad con cualquier dificultad
        } else {
            difficultySim = ordinalSimilarity(diffA, diffB, DIFFICULTY_LEVELS, 2)
        }
    }

    // 6. Similitud de Ritmo (Pacing)
    const pacingSim = ordinalSimilarity(gameA.pacing, gameB.pacing, PACING_LEVELS, 2)

    // 7. Similitud de Duración de Sesión
    const durationSim = ordinalSimilarity(gameA.sessionDuration, gameB.sessionDuration, DURATION_LEVELS, 2)

    // 8. Similitud de Modalidades de Juego
    const modeSim = jaccardSimilarity(gameA.gameModes, gameB.gameModes)

    // Ponderación balanceada
    const weights = {
        genre: 0.25,
        experience: 0.30,
        objective: 0.15,
        difficulty: 0.10,
        pacing: 0.10,
        duration: 0.05,
        mode: 0.05
    }

    const totalSimilarity =
        weights.genre * genreSim +
        weights.experience * expSim +
        weights.objective * objectiveSim +
        weights.difficulty * difficultySim +
        weights.pacing * pacingSim +
        weights.duration * durationSim +
        weights.mode * modeSim

    return Math.min(Math.max(Number(totalSimilarity.toFixed(4)), 0.0), 1.0)
}

/**
 * Calcula la diversidad intra-tanda de un conjunto de videojuegos.
 * Se define como 1.0 menos la similitud media pairwise entre todos los pares únicos.
 *
 * @param {Array<Object>} games Lista de videojuegos o ítems de recomendación
 * @returns {number} Diversidad en [0.0, 1.0]. 1.0 = máxima diversidad, 0.0 = títulos idénticos.
 */
function calculateBatchDiversity(games = []) {
    const rawGames = games.map((g) => (g.game ? g.game : g))
    if (!Array.isArray(rawGames) || rawGames.length <= 1) {
        return 1.0 // Un solo juego o vacío no tiene redundancia interna
    }

    let pairCount = 0
    let similaritySum = 0

    for (let i = 0; i < rawGames.length; i++) {
        for (let j = i + 1; j < rawGames.length; j++) {
            const sim = calculateGameSimilarity(rawGames[i], rawGames[j])
            similaritySum += sim
            pairCount++
        }
    }

    if (pairCount === 0) return 1.0
    const avgSim = similaritySum / pairCount
    return Math.min(Math.max(Number((1.0 - avgSim).toFixed(4)), 0.0), 1.0)
}

/**
 * Selecciona una tanda de recomendaciones equilibrando afinidad y diversidad
 * mediante Relevancia Marginal Máxima (MMR) determinista.
 *
 * Algoritmo:
 * 1. El primer elemento seleccionado es siempre el candidato con mayor afinidad individual (respetando la relevancia principal).
 * 2. En cada paso k posterior, para cada candidato g no seleccionado se evalúa:
 *      MMR(g) = lambda * Aff(g) - (1 - lambda) * max_{s in S} Sim(g, s)
 *    Se selecciona el candidato que maximice este valor.
 * 3. En caso de empate en MMR, se desempata por afinidad individual y luego por título alfabético (reproducibilidad total).
 * 4. La afinidad que se expone al usuario permanece intacta (no se altera el 'score' individual).
 *
 * @param {Array<Object>} candidates Lista ordenada de candidatos con { game, score, breakdown, matchFactors }
 * @param {Object} options Opciones de configuración
 * @param {number} options.limit Cantidad de títulos a seleccionar (default 3)
 * @param {string} options.discoveryMode 'familiar' | 'balanced' | 'exploratory'
 * @param {boolean} options.disableDiversity Si es true, retorna los top por score sin reordenar
 * @returns {Array<Object>} Tanda seleccionada con métricas de diversidad enriquecidas
 */
function selectDiverseRecommendations(candidates = [], options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return []
    }

    const limit = options.limit || 3

    // Si hay menos o igual candidatos que el límite solicitado, retornarlos todos
    if (candidates.length <= limit && !options.forceMMR) {
        return candidates.slice(0, limit)
    }

    // Si la diversidad fue desactivada explícitamente, devolver el top puro por afinidad
    if (options.disableDiversity) {
        return candidates.slice(0, limit)
    }

    const mode = normalizeDiscoveryMode(options.discoveryMode || options.mode)
    const config = getDiscoveryConfig(mode)
    const lambda = config.lambda // familiar: 0.85, balanced: 0.65, exploratory: 0.45

    // Indexar candidatos para garantizar estabilidad determinista y respetar el orden del motor
    const indexedCandidates = candidates.map((c, idx) => ({ ...c, originalIndex: idx }))

    // 1. Primer elemento: el de mayor afinidad individual (Top 1 relevante)
    indexedCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const simBonusA = a.breakdown?.similarBonus ? 1 : 0
        const simBonusB = b.breakdown?.similarBonus ? 1 : 0
        if (simBonusB !== simBonusA) return simBonusB - simBonusA
        return a.originalIndex - b.originalIndex
    })

    const unselected = [...indexedCandidates]
    const selected = []

    const topCandidate = unselected.shift()
    selected.push({
        ...topCandidate,
        diversityMetrics: {
            mmrScore: Number((topCandidate.score / 100).toFixed(4)),
            maxSimilarityToBatch: 0.0,
            avgSimilarityToBatch: 0.0,
            selectionRank: 1,
            discoveryMode: mode
        }
    })

    // Determinar la afinidad máxima para normalización relativa de relevancia
    const maxScore = candidates.reduce((max, c) => Math.max(max, c.score || 0), 0)

    // 2. Iteraciones MMR para completar la tanda de tamaño 'limit'
    while (selected.length < limit && unselected.length > 0) {
        let bestCandidateIndex = -1
        let bestMMR = -Infinity
        let bestMaxSim = 0
        let bestAvgSim = 0

        for (let i = 0; i < unselected.length; i++) {
            const cand = unselected[i]
            // Relevancia relativa normalizada [0.0..1.0] para que no sea distorsionada por escalas bajas
            const normAffinity = maxScore > 0 ? Math.min(Math.max((cand.score || 0) / maxScore, 0.0), 1.0) : 0.0

            // Calcular redundancia máxima y media frente a los ya seleccionados en la tanda
            let maxSim = 0
            let sumSim = 0
            for (const sel of selected) {
                const sim = calculateGameSimilarity(cand.game, sel.game)
                if (sim > maxSim) maxSim = sim
                sumSim += sim
            }
            const avgSim = sumSim / selected.length

            // Ecuación MMR: lambda * Relevancia - (1 - lambda) * Redundancia
            const mmrScore = lambda * normAffinity - (1 - lambda) * maxSim

            // Criterio de selección con desempate determinista
            const currentBest = unselected[bestCandidateIndex]
            if (
                mmrScore > bestMMR ||
                (Math.abs(mmrScore - bestMMR) < 1e-6 && cand.score > currentBest?.score) ||
                (Math.abs(mmrScore - bestMMR) < 1e-6 && cand.score === currentBest?.score &&
                 (cand.breakdown?.similarBonus ? 1 : 0) > (currentBest?.breakdown?.similarBonus ? 1 : 0)) ||
                (Math.abs(mmrScore - bestMMR) < 1e-6 && cand.score === currentBest?.score &&
                 cand.originalIndex < currentBest?.originalIndex)
            ) {
                bestMMR = mmrScore
                bestCandidateIndex = i
                bestMaxSim = maxSim
                bestAvgSim = avgSim
            }
        }

        if (bestCandidateIndex >= 0) {
            const chosen = unselected.splice(bestCandidateIndex, 1)[0]
            selected.push({
                ...chosen,
                diversityMetrics: {
                    mmrScore: Number(bestMMR.toFixed(4)),
                    maxSimilarityToBatch: Number(bestMaxSim.toFixed(4)),
                    avgSimilarityToBatch: Number(bestAvgSim.toFixed(4)),
                    selectionRank: selected.length + 1,
                    discoveryMode: mode
                }
            })
        } else {
            break
        }
    }

    // Calcular diversidad global de la tanda seleccionada
    const batchDiversityScore = calculateBatchDiversity(selected)
    for (const item of selected) {
        if (item.breakdown) {
            item.breakdown.batchDiversity = Math.round(batchDiversityScore * 100)
            item.breakdown.discoveryMode = mode
        }
    }

    return selected
}

/**
 * Sintetiza una explicación sencilla y verificable de la diversidad y contrastes
 * entre los videojuegos recomendados en la tanda.
 *
 * @param {Array<Object>} recommendations Lista de recomendaciones seleccionadas
 * @param {Object} criteria Criterios del usuario
 * @returns {string|null} Explicación de diversidad o null si no aplica
 */
function explainBatchDiversity(recommendations = [], criteria = {}) {
    if (!Array.isArray(recommendations) || recommendations.length <= 1) {
        return null
    }

    const titles = recommendations.map((r) => r.game.title)
    const genres = recommendations.map((r) => r.game.genres?.[0] || "")
    const pacings = recommendations.map((r) => r.game.pacing || "")
    const styles = recommendations.map((r) => r.game.objectiveStyle || "")

    // Identificar aspectos distintivos verificables de cada título
    const contrasts = recommendations.map((rec) => {
        const g = rec.game
        const exp = g.experienceAttributes || {}
        const highlights = []

        if (exp.exploration >= 4) highlights.push("alta exploración")
        if (exp.narrative >= 4) highlights.push("narrativa profunda")
        if (exp.creativity >= 4) highlights.push("enfoque creativo")
        if (exp.strategy >= 4) highlights.push("planificación estratégica")
        if (exp.combat === 0 || exp.combat === 1) highlights.push("sin combates estresantes")
        else if (exp.combat >= 4) highlights.push("combate ágil")
        if (g.objectiveStyle === "libre") highlights.push("libertad a tu ritmo")
        else if (g.objectiveStyle === "guiado") highlights.push("objetivos claros paso a paso")

        const primaryHighlight = highlights[0] || (g.genres?.[0] ? `experiencia de ${g.genres[0]}` : "estilo particular")
        return `**${g.title}** (${primaryHighlight})`
    })

    const mode = normalizeDiscoveryMode(criteria.discoveryPreference)
    let leadText = "Estas opciones mantienen lo que buscas, pero ofrecen experiencias variadas:"
    if (mode === "exploratory") {
        leadText = "Para descubrir propuestas diferentes dentro de tus preferencias, seleccionamos alternativas con estilos de juego contrastantes:"
    } else if (mode === "familiar") {
        leadText = "Estas recomendaciones se concentran fielmente en tus gustos habituales con matices complementarios:"
    }

    return `${leadText} ${contrasts.join(", ")}.`
}

module.exports = {
    calculateGameSimilarity,
    calculateBatchDiversity,
    selectDiverseRecommendations,
    normalizeDiscoveryMode,
    getDiscoveryConfig,
    explainBatchDiversity,
    jaccardSimilarity,
    ordinalSimilarity
}
