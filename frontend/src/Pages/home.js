import React from "react"
import { useNavigate } from "react-router-dom"
import "./Pages.css"

const Home = () => {
    const navigate = useNavigate()

    return (
        <div className="page-container">
            {/* Barra de navegación superior */}
            <header className="page-nav">
                <div className="nav-brand" onClick={() => navigate("/")}>
                    <span>🎮 RecoGames AI</span>
                </div>
                <div className="nav-actions">
                    <button className="btn-secondary" onClick={() => navigate("/add")}>
                        Administrar Preguntas
                    </button>
                    <button className="btn-primary" onClick={() => navigate("/chat")}>
                        Abrir Asistente
                    </button>
                </div>
            </header>

            {/* Sección Principal (Hero) */}
            <main className="home-hero">
                <div className="hero-badge">PROYECTO DE INVESTIGACIÓN ACADÉMICA</div>
                <h1 className="hero-title">
                    Recomendación Inteligente y Personalizada de Videojuegos
                </h1>
                <p className="hero-subtitle">
                    Descubre experiencias de juego adaptadas no solo a lo que juegas, sino a cómo te sientes,
                    tu tiempo disponible y lo que necesitas en cada momento.
                </p>

                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate("/chat")}>
                        Iniciar Conversación con el Asistente ➤
                    </button>
                </div>

                {/* Dimensiones de Personalización */}
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🧘</div>
                        <h4>Contexto Emocional</h4>
                        <p>
                            Indica voluntariamente si buscas relajarte, superar un reto desafiante o desconectar tras un día largo.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">⏱️</div>
                        <h4>Tiempo de Sesión</h4>
                        <p>
                            Encuentra partidas adaptadas a tu disponibilidad, desde partidas cortas de 20-30 min hasta experiencias inmersivas.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">👥</div>
                        <h4>Modalidad y Estilo</h4>
                        <p>
                            Filtra juegos para disfrutar en solitario o títulos cooperativos ideales para coordinar con amigos.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">💡</div>
                        <h4>Explicabilidad Clara</h4>
                        <p>
                            El asistente te explica con transparencia las razones concretas de por qué te recomienda cada título.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Home
