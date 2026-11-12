import React from "react"
import "./QuickReplies.css"

const getReplyIcon = (text = "") => {
    const lower = text.toLowerCase()
    if (lower.includes("relajar") || lower.includes("tranquil") || lower.includes("calma")) return "spa"
    if (lower.includes("historia") || lower.includes("narrativ") || lower.includes("aventura")) return "menu_book"
    if (lower.includes("nuevo") || lower.includes("diferente") || lower.includes("emocion")) return "auto_awesome"
    if (lower.includes("desaf") || lower.includes("reto") || lower.includes("difícil")) return "sports_esports"
    if (lower.includes("sorpréndeme") || lower.includes("no sé") || lower.includes("no estoy seguro") || lower.includes("indistinto")) return "explore"
    if (lower.includes("más") || lower.includes("detalle") || lower.includes("saber")) return "info"
    if (lower.includes("alternativ") || lower.includes("otra") || lower.includes("cambiar")) return "sync"
    if (lower.includes("construir") || lower.includes("crear")) return "handyman"
    if (lower.includes("cooperativo") || lower.includes("amigos")) return "group"
    if (lower.includes("individual") || lower.includes("solo")) return "person"
    return "arrow_forward"
}

const QuickReplies = ({ replies = [], onSelect }) => {
    if (!replies || replies.length === 0) return null

    return (
        <div className="rg-quick-replies-container" role="group" aria-label="Opciones rápidas de respuesta">
            {replies.map((reply, idx) => (
                <button
                    key={idx}
                    type="button"
                    className="rg-quick-reply-pill"
                    onClick={() => onSelect(reply)}
                >
                    <span className="rg-quick-reply-icon material-symbols-outlined" aria-hidden="true">
                        {getReplyIcon(reply)}
                    </span>
                    <span>{reply}</span>
                </button>
            ))}
        </div>
    )
}

export default QuickReplies
