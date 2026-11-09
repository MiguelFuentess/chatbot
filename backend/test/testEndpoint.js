const http = require("http")
const express = require("express")
const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, "../.env") })

const connectDB = require("../config/db")
const recRoutes = require("../routes/recommendationRoutes")

const app = express()
app.use(express.json())
app.use("/api/recommendations", recRoutes)

async function testEndpoint() {
    await connectDB()
    const server = app.listen(5096, () => {
        const payload = JSON.stringify({
            message: "Hola, hoy estoy muy cansado del trabajo y quiero desconectarme 30 minutos jugando solo"
        })

        const req = http.request(
            {
                hostname: "127.0.0.1",
                port: 5096,
                path: "/api/recommendations/chat",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload)
                }
            },
            (res) => {
                let data = ""
                res.on("data", (chunk) => (data += chunk))
                res.on("end", () => {
                    const parsed = JSON.parse(data)
                    console.log("Status:", res.statusCode)
                    console.log("Respuesta:", parsed.reply)
                    console.log("Recomendaciones devueltas:", parsed.recommendations.length)
                    parsed.recommendations.forEach((r, idx) => {
                        console.log(`  ${idx + 1}. ${r.game.title} (${r.score}%) -> ${r.explanation.summaryText}`)
                    })
                    server.close(() => process.exit(0))
                })
            }
        )

        req.write(payload)
        req.end()
    })
}

testEndpoint().catch((err) => {
    console.error(err)
    process.exit(1)
})
