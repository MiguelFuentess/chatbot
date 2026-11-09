import React from "react"
import "./QuickReplies.css"

const QuickReplies = ({ replies = [], onSelect }) => {
    if (!replies || replies.length === 0) return null

    return (
        <div className="quick-replies-container">
            {replies.map((reply, idx) => (
                <button
                    key={idx}
                    type="button"
                    className="quick-reply-pill"
                    onClick={() => onSelect(reply)}
                >
                    {reply}
                </button>
            ))}
        </div>
    )
}

export default QuickReplies
