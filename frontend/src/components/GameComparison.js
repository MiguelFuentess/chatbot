import React, { useState } from "react"
import "./GameComparison.css"

const FALLBACK_SVG =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">' +
        '<defs>' +
        '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#002247"/>' +
        '<stop offset="100%" stop-color="#05386b"/>' +
        '</linearGradient>' +
        '</defs>' +
        '<rect width="100%" height="100%" fill="url(#bg)"/>' +
        '<circle cx="300" cy="110" r="38" fill="#006b5b"/>' +
        '<text x="300" y="122" font-size="34" text-anchor="middle">🎮</text>' +
        '<text x="300" y="185" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#98f4dd" letter-spacing="0.05em" text-anchor="middle">ARTE OFICIAL NO DISPONIBLE</text>' +
        '</svg>'
    )

const GameComparison = ({ comparisonData, onAction, onClose }) => {
    const [imageErrorA, setImageErrorA] = useState(false)
    const [imageErrorB, setImageErrorB] = useState(false)

    if (!comparisonData || !comparisonData.gameA || !comparisonData.gameB) return null

    const {
        gameA,
        gameB,
        affinityA = {},
        affinityB = {},
        attributeComparison = {},
        explanation
    } = comparisonData

    const imgA = !imageErrorA && gameA.imageUrl ? gameA.imageUrl : FALLBACK_SVG
    const imgB = !imageErrorB && gameB.imageUrl ? gameB.imageUrl : FALLBACK_SVG

    const expAttrs = attributeComparison.experienceAttributes || []

    return (
        <section className="rg-comparison-card" aria-label={`Comparación entre ${gameA.title} y ${gameB.title}`}>
            {/* Cabecera Superior del Comparador */}
            <div className="rg-comparison-header">
                <div className="rg-comp-header-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                        compare_arrows
                    </span>
                    <span>COMPARADOR VISUAL DE VIDEOJUEGOS</span>
                </div>
                {onClose && (
                    <button
                        type="button"
                        className="rg-comp-close-btn"
                        onClick={onClose}
                        title="Cerrar comparación"
                        aria-label="Cerrar comparación"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Cabecera Cara a Cara: Imágenes, Títulos y Afinidad */}
            <div className="rg-comp-matchup-grid">
                {/* Lado A */}
                <div className="rg-comp-game-col">
                    <div className="rg-comp-poster-box">
                        <img
                            src={imgA}
                            alt={`Carátula de ${gameA.title}`}
                            className="rg-comp-poster-img"
                            loading="lazy"
                            onError={() => setImageErrorA(true)}
                        />
                        <div className="rg-comp-poster-gradient" aria-hidden="true" />
                        <span className="rg-comp-poster-tag rg-tag-a">Opción 1</span>
                    </div>

                    <h3 className="rg-comp-game-title">{gameA.title}</h3>

                    {/* Badge de Afinidad Personalizada */}
                    {affinityA.hasSufficientCriteria ? (
                        <div className={`rg-comp-affinity-badge ${affinityA.isRestricted ? "is-restricted" : ""}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }} aria-hidden="true">
                                {affinityA.isRestricted ? "warning" : "verified"}
                            </span>
                            <span>{affinityA.score}% Afinidad</span>
                        </div>
                    ) : (
                        <div className="rg-comp-affinity-badge is-neutral">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }} aria-hidden="true">
                                info
                            </span>
                            <span>Comparación descriptiva</span>
                        </div>
                    )}

                    {affinityA.isRestricted && affinityA.violations && affinityA.violations.length > 0 && (
                        <p className="rg-comp-restriction-warn">
                            ⚠️ {affinityA.violations[0]}
                        </p>
                    )}
                </div>

                {/* Divisor VS Central */}
                <div className="rg-comp-vs-badge" aria-hidden="true">
                    <span>VS</span>
                </div>

                {/* Lado B */}
                <div className="rg-comp-game-col">
                    <div className="rg-comp-poster-box">
                        <img
                            src={imgB}
                            alt={`Carátula de ${gameB.title}`}
                            className="rg-comp-poster-img"
                            loading="lazy"
                            onError={() => setImageErrorB(true)}
                        />
                        <div className="rg-comp-poster-gradient" aria-hidden="true" />
                        <span className="rg-comp-poster-tag rg-tag-b">Opción 2</span>
                    </div>

                    <h3 className="rg-comp-game-title">{gameB.title}</h3>

                    {/* Badge de Afinidad Personalizada */}
                    {affinityB.hasSufficientCriteria ? (
                        <div className={`rg-comp-affinity-badge ${affinityB.isRestricted ? "is-restricted" : ""}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }} aria-hidden="true">
                                {affinityB.isRestricted ? "warning" : "verified"}
                            </span>
                            <span>{affinityB.score}% Afinidad</span>
                        </div>
                    ) : (
                        <div className="rg-comp-affinity-badge is-neutral">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }} aria-hidden="true">
                                info
                            </span>
                            <span>Comparación descriptiva</span>
                        </div>
                    )}

                    {affinityB.isRestricted && affinityB.violations && affinityB.violations.length > 0 && (
                        <p className="rg-comp-restriction-warn">
                            ⚠️ {affinityB.violations[0]}
                        </p>
                    )}
                </div>
            </div>

            {/* Bloque de Análisis y Explicación Personalizada */}
            {explanation && (
                <div className="rg-comp-callout">
                    <div className="rg-comp-callout-header">
                        <span className="material-symbols-outlined rg-callout-icon" aria-hidden="true">
                            psychology
                        </span>
                        <span className="rg-comp-callout-title">Análisis comparativo del asistente</span>
                    </div>
                    <p className="rg-comp-callout-text">{explanation}</p>
                </div>
            )}

            {/* Tabla Comparativa de Metadatos Generales */}
            <div className="rg-comp-meta-table-wrap">
                <table className="rg-comp-meta-table" aria-label="Tabla de atributos generales">
                    <thead>
                        <tr>
                            <th scope="col" className="rg-col-game-a">{gameA.title}</th>
                            <th scope="col" className="rg-col-feature">Característica</th>
                            <th scope="col" className="rg-col-game-b">{gameB.title}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Géneros */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val">
                                    {(gameA.genres || []).slice(0, 3).join(", ") || "No especificado"}
                                </span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Géneros</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val">
                                    {(gameB.genres || []).slice(0, 3).join(", ") || "No especificado"}
                                </span>
                            </td>
                        </tr>

                        {/* Modalidad */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val">
                                    {(gameA.gameModes || []).join(", ") || "Individual"}
                                </span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Modalidad</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val">
                                    {(gameB.gameModes || []).join(", ") || "Individual"}
                                </span>
                            </td>
                        </tr>

                        {/* Duración de Sesión */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val">{gameA.sessionDuration || "No indicada"}</span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Duración de sesión</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val">{gameB.sessionDuration || "No indicada"}</span>
                            </td>
                        </tr>

                        {/* Dificultad */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val rg-capitalize">{gameA.difficulty || "media"}</span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Dificultad</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val rg-capitalize">{gameB.difficulty || "media"}</span>
                            </td>
                        </tr>

                        {/* Ritmo */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val rg-capitalize">{gameA.pacing || "moderado"}</span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Ritmo</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val rg-capitalize">{gameB.pacing || "moderado"}</span>
                            </td>
                        </tr>

                        {/* Precio */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val">{gameA.priceCondition || "De pago"}</span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Condición de precio</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val">{gameB.priceCondition || "De pago"}</span>
                            </td>
                        </tr>

                        {/* Estilo de Objetivos */}
                        <tr>
                            <td className="rg-col-game-a">
                                <span className="rg-meta-val rg-capitalize">{gameA.objectiveStyle || "No clasificado"}</span>
                            </td>
                            <td className="rg-col-feature">
                                <span className="rg-feature-tag">Estilo de objetivos</span>
                            </td>
                            <td className="rg-col-game-b">
                                <span className="rg-meta-val rg-capitalize">{gameB.objectiveStyle || "No clasificado"}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Atributos de Experiencia Graduables (Escala 0 a 5) */}
            <div className="rg-comp-exp-section">
                <h4 className="rg-comp-exp-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                        tune
                    </span>
                    <span>Atributos de experiencia de juego (Escala 0 a 5)</span>
                </h4>

                <div className="rg-comp-exp-list">
                    {expAttrs.map((item) => {
                        const hasValA = item.valA !== null && item.valA !== undefined
                        const hasValB = item.valB !== null && item.valB !== undefined
                        const pctA = hasValA ? (item.valA / 5) * 100 : 0
                        const pctB = hasValB ? (item.valB / 5) * 100 : 0

                        return (
                            <div key={item.key} className="rg-comp-exp-row">
                                <div className="rg-exp-col-side rg-exp-left">
                                    <div className="rg-exp-bar-wrap rg-bar-reverse">
                                        <div
                                            className="rg-exp-bar rg-bar-a"
                                            style={{ width: `${pctA}%` }}
                                            aria-valuenow={item.valA}
                                            aria-valuemin="0"
                                            aria-valuemax="5"
                                            role="progressbar"
                                        />
                                    </div>
                                    <span className="rg-exp-num">
                                        {hasValA ? `${item.valA}/5` : "Sin información suficiente"}
                                    </span>
                                </div>

                                <div className="rg-exp-label-center">
                                    <span className="rg-exp-title">{item.label}</span>
                                    {item.higher === "A" && hasValA && (
                                        <span className="rg-exp-lead-tag rg-tag-a">+{item.diff} en {gameA.title}</span>
                                    )}
                                    {item.higher === "B" && hasValB && (
                                        <span className="rg-exp-lead-tag rg-tag-b">+{item.diff} en {gameB.title}</span>
                                    )}
                                </div>

                                <div className="rg-exp-col-side rg-exp-right">
                                    <span className="rg-exp-num">
                                        {hasValB ? `${item.valB}/5` : "Sin información suficiente"}
                                    </span>
                                    <div className="rg-exp-bar-wrap">
                                        <div
                                            className="rg-exp-bar rg-bar-b"
                                            style={{ width: `${pctB}%` }}
                                            aria-valuenow={item.valB}
                                            aria-valuemin="0"
                                            aria-valuemax="5"
                                            role="progressbar"
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Acciones Funcionales del Comparador (Sección 11) */}
            {onAction && (
                <div className="rg-comp-actions-bar">
                    <button
                        type="button"
                        className="rg-comp-btn rg-btn-choose-a"
                        onClick={() => onAction(`Me interesa ${gameA.title}`)}
                        title={`Elegir ${gameA.title}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                            check_circle
                        </span>
                        <span>Elegir {gameA.title}</span>
                    </button>

                    <button
                        type="button"
                        className="rg-comp-btn rg-btn-choose-b"
                        onClick={() => onAction(`Me interesa ${gameB.title}`)}
                        title={`Elegir ${gameB.title}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                            check_circle
                        </span>
                        <span>Elegir {gameB.title}</span>
                    </button>

                    <button
                        type="button"
                        className="rg-comp-btn rg-btn-more-info"
                        onClick={() => onAction(`¿Cuál tiene menos combate entre ${gameA.title} y ${gameB.title}?`)}
                        title="Preguntar sobre combate"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                            swords
                        </span>
                        <span>¿Cuál tiene menos combate?</span>
                    </button>

                    <button
                        type="button"
                        className="rg-comp-btn rg-btn-alt"
                        onClick={() => onAction("Buscar alternativas a ambos")}
                        title="Buscar alternativas a ambos videojuegos"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                            sync
                        </span>
                        <span>Buscar alternativas a ambos</span>
                    </button>
                </div>
            )}
        </section>
    )
}

export default GameComparison
