import React, { useState, useEffect } from "react"
import "./PlayerProfile.css"

const AVAILABLE_GENRES = [
    "RPG",
    "Acción",
    "Aventura",
    "Estrategia",
    "Simulación",
    "Terror",
    "Puzzles",
    "Plataformas",
    "Shooter",
    "Survival",
    "Construcción",
    "Roguelike",
    "Indie",
    "Deportes"
]

const AVAILABLE_TIMES = [
    { label: "Menos de 30 min (sesión corta)", value: "menos de 30 minutos" },
    { label: "Entre 30 y 60 min (sesión media)", value: "entre 30 y 60 minutos" },
    { label: "Más de 60 min (sesión larga)", value: "más de 60 minutos" }
]

const AVAILABLE_MODES = [
    { label: "Un jugador (Singleplayer)", value: "un jugador" },
    { label: "Multijugador", value: "multijugador" },
    { label: "Cooperativo", value: "cooperativo" }
]

const AVAILABLE_DIFFICULTIES = [
    { label: "Relajada / Accesible", value: "relajada" },
    { label: "Equilibrada / Moderada", value: "equilibrada" },
    { label: "Desafiante / Alta", value: "desafiante" }
]

const DISCOVERY_MODES = [
    {
        key: "familiar",
        label: "Familiar",
        desc: "Prioriza tus géneros habituales y títulos más afines"
    },
    {
        key: "balanced",
        label: "Equilibrado",
        desc: "Recomendado: balance óptimo entre afinidad y variedad"
    },
    {
        key: "exploratory",
        label: "Exploratorio",
        desc: "Mayor diversidad y descubrimiento de nuevas joyas"
    }
]

const EXPERIENCE_ATTRS = [
    { key: "narrative", label: "Historia y narrativa" },
    { key: "exploration", label: "Exploración y mundo abierto" },
    { key: "creativity", label: "Creatividad y construcción" },
    { key: "strategy", label: "Estrategia y táctica" },
    { key: "combat", label: "Combate y acción intensa" },
    { key: "freedom", label: "Libertad y final abierto" },
    { key: "complexity", label: "Complejidad y profundidad" }
]

const PlayerProfile = ({
    isOpen,
    onClose,
    conversationMemory,
    accumulatedCriteria = {},
    onUpdateProfile
}) => {
    const [selectedNewGenre, setSelectedNewGenre] = useState("")
    const [selectedNewExclusion, setSelectedNewExclusion] = useState("")
    const [feedbackMsg, setFeedbackMsg] = useState(null)
    const [isUpdating, setIsUpdating] = useState(false)

    // Cierre con la tecla Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    // Extracción segura de datos combinando conversationMemory y accumulatedCriteria
    const mem = conversationMemory || {}
    const habitual = mem.habitualPreferences || {}
    const current = mem.currentNeeds || {}
    const past = mem.pastExperiences || {}

    // A. Gustos habituales
    const habitualGenres = habitual.genres || accumulatedCriteria.habitualTastes || []
    const habitualFeatures = habitual.features || accumulatedCriteria.likedFeatures || []
    const likedGames = past.likedGames || accumulatedCriteria.likedGames || []

    // B. Lo que busca hoy
    const currentEmotions = current.emotion || accumulatedCriteria.emotionalContext || []
    const preferredGenres = current.preferredGenres || accumulatedCriteria.preferredGenres || []
    const availableTime = current.availableTime || accumulatedCriteria.availableTime || null
    const gameMode = current.gameMode || accumulatedCriteria.gameMode || null
    const desiredDifficulty = current.desiredDifficulty || accumulatedCriteria.desiredDifficulty || null
    const discoveryPref = current.discoveryPreference || accumulatedCriteria.discoveryPreference || "balanced"
    const expPrefs = current.experiencePreferences || accumulatedCriteria.experiencePreferences || {}

    // C. Preferencias negativas
    const dislikedGenres = current.dislikedGenres || accumulatedCriteria.dislikedGenres || []
    const dislikedFeatures = current.dislikedFeatures || accumulatedCriteria.dislikedFeatures || []
    const dislikedGames = past.dislikedGames || accumulatedCriteria.dislikedGames || []

    // D. Seguimiento
    const interestedGames = mem.interestedGames || accumulatedCriteria.interestedGames || []

    const showFeedback = (msg) => {
        setFeedbackMsg(msg)
        setTimeout(() => setFeedbackMsg(null), 3500)
    }

    const handleAction = async (action) => {
        if (!onUpdateProfile || isUpdating) return
        try {
            setIsUpdating(true)
            await onUpdateProfile(action)
            showFeedback("Preferencia actualizada correctamente")
        } catch (error) {
            console.error("Error al actualizar preferencia:", error)
            showFeedback("Error al actualizar preferencia")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleAddPreferredGenre = () => {
        if (!selectedNewGenre) return
        handleAction({
            type: "change_genre",
            value: selectedNewGenre,
            operation: "add"
        })
        setSelectedNewGenre("")
    }

    const handleAddExclusion = () => {
        if (!selectedNewExclusion) return
        handleAction({
            type: "add_exclusion",
            value: selectedNewExclusion
        })
        setSelectedNewExclusion("")
    }

    return (
        <div className="rg-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="rg-profile-title">
            <div className="rg-profile-backdrop" onClick={onClose} aria-hidden="true" />

            <aside className="rg-profile-drawer" aria-label="Perfil temporal del jugador">
                {/* Cabecera del Drawer */}
                <header className="rg-profile-header">
                    <div className="rg-profile-header-text">
                        <div className="rg-profile-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }} aria-hidden="true">
                                lock_clock
                            </span>
                            <span>Sesión Activa</span>
                        </div>
                        <h2 id="rg-profile-title" className="rg-profile-title">
                            Mis preferencias
                        </h2>
                        <p className="rg-profile-subtitle">
                            Preferencias aprendidas y activas durante esta conversación.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rg-profile-close-btn"
                        onClick={onClose}
                        aria-label="Cerrar panel de preferencias"
                        title="Cerrar (Esc)"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </header>

                {/* Notificación Toast de feedback */}
                {feedbackMsg && (
                    <div className="rg-profile-toast" role="status" aria-live="polite">
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">
                            check_circle
                        </span>
                        <span>{feedbackMsg}</span>
                    </div>
                )}

                {/* Aviso de privacidad / temporalidad */}
                <div className="rg-profile-notice">
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">
                        info
                    </span>
                    <span>
                        Este perfil es estrictamente <strong>temporal</strong>. No se guarda en base de datos ni requiere cuenta. Al pulsar <em>Nueva conversación</em> se reinicia por completo.
                    </span>
                </div>

                {/* Cuerpo desplazable de preferencias */}
                <div className="rg-profile-body">
                    {/* SECCIÓN A: GUSTOS HABITUALES */}
                    <section className="rg-profile-section" aria-labelledby="sec-habitual">
                        <div className="rg-section-header">
                            <span className="material-symbols-outlined rg-sec-icon" aria-hidden="true">
                                favorite
                            </span>
                            <h3 id="sec-habitual" className="rg-section-title">
                                A. Gustos habituales
                            </h3>
                        </div>

                        {/* Géneros habituales */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Géneros que sueles jugar:</span>
                            {habitualGenres.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {habitualGenres.map((g, i) => (
                                        <span key={i} className="rg-chip rg-chip-habitual">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Características preferidas */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Características favoritas:</span>
                            {habitualFeatures.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {habitualFeatures.map((f, i) => (
                                        <span key={i} className="rg-chip rg-chip-feature">
                                            <span>{f}</span>
                                            <button
                                                type="button"
                                                className="rg-chip-del-btn"
                                                onClick={() => handleAction({ type: "remove_feature", value: f })}
                                                title={`Eliminar característica "${f}"`}
                                                aria-label={`Eliminar ${f}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Juegos favoritos mencionados */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Juegos favoritos de referencia:</span>
                            {likedGames.length > 0 ? (
                                <ul className="rg-games-list">
                                    {likedGames.map((game, i) => {
                                        const title = typeof game === "string" ? game : game.title
                                        const motive = typeof game === "object" ? game.motive : null
                                        return (
                                            <li key={i} className="rg-game-item">
                                                <span className="rg-game-title">🎮 {title}</span>
                                                {motive && <span className="rg-game-motive">«{motive}»</span>}
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN B: LO QUE BUSCA ACTUALMENTE (SESIÓN ACTIVA) */}
                    <section className="rg-profile-section" aria-labelledby="sec-current">
                        <div className="rg-section-header">
                            <span className="material-symbols-outlined rg-sec-icon" aria-hidden="true">
                                explore
                            </span>
                            <h3 id="sec-current" className="rg-section-title">
                                B. Lo que buscas para hoy
                            </h3>
                        </div>

                        {/* Tipo de experiencia / emoción */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Experiencia deseada:</span>
                            {currentEmotions.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {currentEmotions.map((emo, i) => (
                                        <span key={i} className="rg-chip rg-chip-emotion">
                                            ✨ {emo}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Géneros preferidos activos con edición */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Géneros activos para esta sesión:</span>
                            {preferredGenres.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {preferredGenres.map((g, i) => (
                                        <span key={i} className="rg-chip rg-chip-active-genre">
                                            <span>{g}</span>
                                            <button
                                                type="button"
                                                className="rg-chip-del-btn"
                                                onClick={() => handleAction({ type: "delete_genre", value: g })}
                                                title={`Eliminar género "${g}"`}
                                                aria-label={`Eliminar género ${g}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}

                            {/* Selector para agregar o cambiar género preferido */}
                            <div className="rg-inline-adder">
                                <select
                                    className="rg-select-input"
                                    value={selectedNewGenre}
                                    onChange={(e) => setSelectedNewGenre(e.target.value)}
                                    aria-label="Seleccionar género para añadir"
                                >
                                    <option value="">+ Añadir género preferido...</option>
                                    {AVAILABLE_GENRES.filter((g) => !preferredGenres.includes(g)).map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="rg-adder-btn"
                                    disabled={!selectedNewGenre || isUpdating}
                                    onClick={handleAddPreferredGenre}
                                >
                                    Añadir
                                </button>
                            </div>
                        </div>

                        {/* Tiempo disponible */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Tiempo disponible por sesión:</span>
                            <div className="rg-segmented-options">
                                {AVAILABLE_TIMES.map((t) => {
                                    const isSelected = availableTime && availableTime.toLowerCase().includes(t.value.toLowerCase().slice(0, 10))
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            className={`rg-option-btn ${isSelected ? "selected" : ""}`}
                                            onClick={() =>
                                                handleAction({
                                                    type: "change_time",
                                                    value: isSelected ? null : t.value
                                                })
                                            }
                                        >
                                            {t.label}
                                        </button>
                                    )
                                })}
                            </div>
                            {!availableTime && (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Modo de juego */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Modo de juego:</span>
                            <div className="rg-segmented-options">
                                {AVAILABLE_MODES.map((m) => {
                                    const isSelected = gameMode && gameMode.toLowerCase() === m.value.toLowerCase()
                                    return (
                                        <button
                                            key={m.value}
                                            type="button"
                                            className={`rg-option-btn ${isSelected ? "selected" : ""}`}
                                            onClick={() =>
                                                handleAction({
                                                    type: "change_mode",
                                                    value: isSelected ? null : m.value
                                                })
                                            }
                                        >
                                            {m.label}
                                        </button>
                                    )
                                })}
                            </div>
                            {!gameMode && (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Dificultad deseada */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Dificultad deseada:</span>
                            <div className="rg-segmented-options">
                                {AVAILABLE_DIFFICULTIES.map((d) => {
                                    const isSelected = desiredDifficulty && desiredDifficulty.toLowerCase() === d.value.toLowerCase()
                                    return (
                                        <button
                                            key={d.value}
                                            type="button"
                                            className={`rg-option-btn ${isSelected ? "selected" : ""}`}
                                            onClick={() =>
                                                handleAction({
                                                    type: "change_difficulty",
                                                    value: isSelected ? null : d.value
                                                })
                                            }
                                        >
                                            {d.label}
                                        </button>
                                    )
                                })}
                            </div>
                            {!desiredDifficulty && (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Modo de diversidad y descubrimiento (Etapa 4 y 5) */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">
                                Nivel de descubrimiento y variedad (MMR):
                            </span>
                            <div className="rg-discovery-cards-grid">
                                {DISCOVERY_MODES.map((dm) => {
                                    const isActive = discoveryPref === dm.key
                                    return (
                                        <button
                                            key={dm.key}
                                            type="button"
                                            className={`rg-discovery-card ${isActive ? "active" : ""}`}
                                            onClick={() =>
                                                handleAction({
                                                    type: "change_discovery",
                                                    value: dm.key
                                                })
                                            }
                                        >
                                            <div className="rg-discovery-card-top">
                                                <span className="rg-discovery-card-name">{dm.label}</span>
                                                {isActive && (
                                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                                        check_circle
                                                    </span>
                                                )}
                                            </div>
                                            <p className="rg-discovery-card-desc">{dm.desc}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Atributos de experiencia (Etapa 3) */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Atributos de experiencia destacados:</span>
                            {Object.values(expPrefs).some((v) => v != null && v !== false) ? (
                                <div className="rg-chips-wrap">
                                    {EXPERIENCE_ATTRS.filter((attr) => expPrefs[attr.key]).map((attr) => (
                                        <span key={attr.key} className="rg-chip rg-chip-attr">
                                            {attr.label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN C: PREFERENCIAS NEGATIVAS Y RESTRICCIONES */}
                    <section className="rg-profile-section" aria-labelledby="sec-negative">
                        <div className="rg-section-header">
                            <span className="material-symbols-outlined rg-sec-icon rg-sec-icon-negative" aria-hidden="true">
                                block
                            </span>
                            <h3 id="sec-negative" className="rg-section-title">
                                C. Preferencias a evitar y restricciones
                            </h3>
                        </div>

                        {/* Géneros a evitar / exclusiones */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Géneros o temáticas excluidas:</span>
                            {dislikedGenres.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {dislikedGenres.map((g, i) => (
                                        <span key={i} className="rg-chip rg-chip-disliked">
                                            <span>🚫 {g}</span>
                                            <button
                                                type="button"
                                                className="rg-chip-del-btn"
                                                onClick={() => handleAction({ type: "remove_exclusion", value: g })}
                                                title={`Quitar exclusión de "${g}"`}
                                                aria-label={`Quitar exclusión de ${g}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}

                            {/* Selector para agregar exclusión */}
                            <div className="rg-inline-adder">
                                <select
                                    className="rg-select-input"
                                    value={selectedNewExclusion}
                                    onChange={(e) => setSelectedNewExclusion(e.target.value)}
                                    aria-label="Seleccionar género para excluir"
                                >
                                    <option value="">+ Añadir género a evitar...</option>
                                    {AVAILABLE_GENRES.filter((g) => !dislikedGenres.includes(g)).map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="rg-adder-btn rg-adder-btn-danger"
                                    disabled={!selectedNewExclusion || isUpdating}
                                    onClick={handleAddExclusion}
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>

                        {/* Elementos o mecánicas no deseadas */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Elementos o mecánicas no deseadas:</span>
                            {dislikedFeatures.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {dislikedFeatures.map((f, i) => (
                                        <span key={i} className="rg-chip rg-chip-disliked">
                                            <span>🚫 {f}</span>
                                            <button
                                                type="button"
                                                className="rg-chip-del-btn"
                                                onClick={() => handleAction({ type: "remove_disliked_feature", value: f })}
                                                title={`Eliminar "${f}"`}
                                                aria-label={`Eliminar ${f}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Videojuegos descartados o rechazados */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Videojuegos no deseados o descartados:</span>
                            {dislikedGames.length > 0 ? (
                                <ul className="rg-games-list">
                                    {dislikedGames.map((game, i) => {
                                        const title = typeof game === "string" ? game : game.title
                                        const motive = typeof game === "object" ? game.motive : null
                                        return (
                                            <li key={i} className="rg-game-item rg-game-item-disliked">
                                                <span className="rg-game-title">❌ {title}</span>
                                                {motive && <span className="rg-game-motive">«{motive}»</span>}
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>
                    </section>

                    {/* SECCIÓN D: EXPERIENCIAS Y SEGUIMIENTO */}
                    <section className="rg-profile-section" aria-labelledby="sec-tracking">
                        <div className="rg-section-header">
                            <span className="material-symbols-outlined rg-sec-icon" aria-hidden="true">
                                bookmark
                            </span>
                            <h3 id="sec-tracking" className="rg-section-title">
                                D. Experiencias y seguimiento
                            </h3>
                        </div>

                        {/* Juegos sobre los que mostró interés */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Títulos que llamaron tu atención:</span>
                            {interestedGames.length > 0 ? (
                                <ul className="rg-games-list">
                                    {interestedGames.map((game, i) => {
                                        const title = typeof game === "string" ? game : game.title || game.name
                                        return (
                                            <li key={i} className="rg-game-item">
                                                <span className="rg-game-title">⭐ {title}</span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>

                        {/* Juegos favoritos reconocidos */}
                        <div className="rg-profile-field">
                            <span className="rg-field-label">Juegos favoritos en la sesión:</span>
                            {likedGames.length > 0 ? (
                                <div className="rg-chips-wrap">
                                    {likedGames.map((game, i) => {
                                        const title = typeof game === "string" ? game : game.title
                                        return (
                                            <span key={i} className="rg-chip rg-chip-habitual">
                                                ❤️ {title}
                                            </span>
                                        )
                                    })}
                                </div>
                            ) : (
                                <span className="rg-empty-text">Todavía no hemos hablado de esto</span>
                            )}
                        </div>
                    </section>
                </div>

                {/* Pie del Drawer */}
                <footer className="rg-profile-footer">
                    <button
                        type="button"
                        className="rg-profile-btn-close"
                        onClick={onClose}
                    >
                        Listo, volver a la conversación
                    </button>
                </footer>
            </aside>
        </div>
    )
}

export default PlayerProfile
