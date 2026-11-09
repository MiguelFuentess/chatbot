const express = require("express")
const router = express.Router()
const { evaluateCriteria, handleChatConversation } = require("../controllers/recommendationController")

router.post("/chat", handleChatConversation)
router.post("/evaluate", evaluateCriteria)

module.exports = router
