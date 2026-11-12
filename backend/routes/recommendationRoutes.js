const express = require("express")
const router = express.Router()
const {
    evaluateCriteria,
    handleChatConversation,
    handleProfileUpdate,
    handleCompareGames
} = require("../controllers/recommendationController")

router.post("/chat", handleChatConversation)
router.post("/evaluate", evaluateCriteria)
router.post("/profile-update", handleProfileUpdate)
router.post("/compare", handleCompareGames)

module.exports = router
