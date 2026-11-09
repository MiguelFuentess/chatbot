const express = require("express")
const router = express.Router()
const { getGames, getGameById, getGenres } = require("../controllers/gameController")

router.get("/genres", getGenres)
router.get("/:id", getGameById)
router.get("/", getGames)

module.exports = router
