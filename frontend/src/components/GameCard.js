import React from "react"
import "./GameCard.css"

const GameCard = ({ recommendation }) => {
    if (!recommendation || !recommendation.game) return null

    const { game, score, explanation } = recommendation

    const fallbackImage =
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80"

    return (
        <div className="game-card">
            <div className="game-card-image-container">
                <img
                    src={game.imageUrl || fallbackImage}
                    alt={game.title}
                    className="game-card-image"
                    onError={(e) => {
                        e.target.onerror = null
                        e.target.src = fallbackImage
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
