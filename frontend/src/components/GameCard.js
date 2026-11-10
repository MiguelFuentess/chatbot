import React, { useState } from "react"
import "./GameCard.css"

// Fallback neutro SVG autocontenido (evita fotos genéricas de stock de terceros)
const FALLBACK_SVG =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215" viewBox="0 0 460 215">' +
        '<defs>' +
        '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#1e293b"/>' +
        '<stop offset="100%" stop-color="#0f172a"/>' +
        '</linearGradient>' +
        '</defs>' +
        '<rect width="100%" height="100%" fill="url(#bg)"/>' +
        '<circle cx="230" cy="85" r="32" fill="#334155"/>' +
        '<text x="230" y="94" font-size="28" text-anchor="middle">🎮</text>' +
        '<text x="230" y="142" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#94a3b8" text-anchor="middle">Arte oficial no disponible</text>' +
        '</svg>'
    )

const GameCard = ({ recommendation }) => {
    const [imageError, setImageError] = useState(false)

    if (!recommendation || !recommendation.game) return null

    const { game, score, explanation } = recommendation
    const displayImage = !imageError && game.imageUrl ? game.imageUrl : FALLBACK_SVG

    return (
        <div className="game-card">
            <div className="game-card-image-container">
                <img
                    src={displayImage}
                    alt={game.title}
                    className={`game-card-image ${imageError ? "is-fallback" : ""}`}
                    loading="lazy"
                    onError={() => {
                        setImageError(true)
                    }}
                />
                <div className="game-card-score-badge">
                    <span>★ {score}% de afinidad</span>
                </div>
                <div className="game-card-price-badge">
                    <span>{game.priceCondition || "PC"}</span>
                </div>
            </div>

            <div className="game-card-content">
                <h4 className="game-card-title">{game.title}</h4>
                <p className="game-card-description">{game.description}</p>

                <div className="game-card-tags">
                    {game.genres &&
                        game.genres.slice(0, 3).map((genre, idx) => (
                            <span key={idx} className="game-badge badge-genre">
                                {genre}
                            </span>
                        ))}
                    {game.sessionDuration && (
                        <span className="game-badge badge-duration">⏱️ {game.sessionDuration}</span>
                    )}
                    {game.gameModes && (
                        <span className="game-badge badge-mode">👥 {game.gameModes.join(", ")}</span>
                    )}
                </div>

                {explanation && explanation.summaryText && (
                    <div className="game-card-explanation">
                        <div className="explanation-header">
                            <span>💡 ¿Por qué te lo recomendamos?</span>
                        </div>
                        <p className="explanation-text">{explanation.summaryText}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default GameCard
