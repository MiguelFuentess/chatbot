import React, { useState } from "react"
import "./GameCard.css"

// Fallback neutro SVG autocontenido con estética editorial
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

const GameCard = ({ recommendation, onAction, onCompare, isSelectedForCompare = false }) => {
    const [imageError, setImageError] = useState(false)

    if (!recommendation || !recommendation.game) return null

    const { game, score, explanation } = recommendation
    const displayImage = !imageError && game.imageUrl ? game.imageUrl : FALLBACK_SVG

    const genreText = Array.isArray(game.genres) && game.genres.length > 0
        ? game.genres.slice(0, 3).join(" & ")
        : "Videojuego de PC"

    const durationText = game.sessionDuration || null
    const modeText = Array.isArray(game.gameModes) && game.gameModes.length > 0
        ? game.gameModes.join(", ")
        : null

    const metaParts = [genreText, durationText, modeText].filter(Boolean)
    const metaString = metaParts.join(" • ")

    return (
        <article className="rg-game-card" aria-label={`Recomendación: ${game.title}`}>
            {/* Banner de Imagen con Cabecera Integrada */}
            <div className="rg-game-card-banner">
                <img
                    src={displayImage}
                    alt={`Portada oficial de ${game.title}`}
                    className={`rg-game-card-img ${imageError ? "is-fallback" : ""}`}
                    loading="lazy"
                    onError={() => setImageError(true)}
                />
                <div className="rg-game-card-gradient" aria-hidden="true" />

                {/* Badge Flotante Superior */}
                <div className="rg-game-card-badge">
                    <span className="material-symbols-outlined" aria-hidden="true">stars</span>
                    <span>RECOMENDACIÓN RECIENTE • {score}% AFINIDAD</span>
                </div>

                {/* Título y Metadatos sobre el Banner */}
                <div className="rg-game-card-header-overlay">
                    <h3 className="rg-game-card-title">{game.title}</h3>
                    <p className="rg-game-card-meta">{metaString}</p>
                </div>
            </div>

            {/* Cuerpo de la Tarjeta */}
            <div className="rg-game-card-body">
                <p className="rg-game-card-desc">{game.description}</p>

                {/* Bloque: Por qué encaja contigo */}
                {explanation && explanation.summaryText && (
                    <div className="rg-game-card-callout">
                        <span className="material-symbols-outlined rg-callout-icon" aria-hidden="true">
                            psychology
                        </span>
                        <div className="rg-callout-content">
                            <span className="rg-callout-label">Por qué encaja contigo</span>
                            <p className="rg-callout-text">{explanation.summaryText}</p>
                        </div>
                    </div>
                )}

                {/* Botones de Acción Interactiva (Etapa 5) */}
                {onAction && (
                    <div className="rg-game-card-actions">
                        <button
                            type="button"
                            className="rg-card-btn rg-btn-more"
                            onClick={() => onAction(`Quiero saber más sobre ${game.title}`)}
                            title={`Preguntar más detalles sobre ${game.title}`}
                        >
                            <span>Cuéntame más</span>
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                arrow_forward
                            </span>
                        </button>

                        <button
                            type="button"
                            className="rg-card-btn rg-btn-interest"
                            onClick={() => onAction(`Me interesa ${game.title}`)}
                            title={`Indicar interés por ${game.title}`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                star
                            </span>
                            <span>Me interesa</span>
                        </button>

                        <button
                            type="button"
                            className="rg-card-btn rg-btn-discard"
                            onClick={() => onAction(`No me convence ${game.title}`)}
                            title={`Descartar ${game.title}`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                close
                            </span>
                            <span>Descartar</span>
                        </button>

                        <button
                            type="button"
                            className={`rg-card-btn rg-btn-compare ${isSelectedForCompare ? "is-selected" : ""}`}
                            onClick={() => (onCompare ? onCompare(game) : onAction(`Comparar ${game.title}`))}
                            title={isSelectedForCompare ? "Seleccionado para comparar" : `Comparar ${game.title} con otro juego`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">
                                compare_arrows
                            </span>
                            <span>{isSelectedForCompare ? "Seleccionado" : "Comparar"}</span>
                        </button>
                    </div>
                )}
            </div>
        </article>
    )
}

export default GameCard
