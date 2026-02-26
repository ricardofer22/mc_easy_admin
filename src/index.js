import express from "express"
import util from "node:util"
import child_process from "node:child_process"
import fs from "node:fs"
import { spawn } from "child_process"
import { Server } from "socket.io"
import { createServer } from "http"

const app = express()
const port = 3000
const httpServer = createServer(app)
const io = new Server(httpServer)

const javaEnv = {
  ...process.env,
  JAVA_HOME: '/usr/local/java/jdk-25.0.2+10',
  PATH: `/usr/local/java/jdk-25.0.2+10/bin:${process.env.PATH}`
}

const download = `mkdir -p mcsv && wget -O mcsv/server.jar https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar`
const execute = `cd mcsv && java -Xmx4G -Xms4G -jar server.jar nogui`

app.set("view engine", "ejs")
app.set("views", "src/views")

app.get("/", (req, res) => {
  res.render("index")
})

const exec = util.promisify(child_process.exec)

let minecraftProcess = null

app.post("/run", async (req, res) => {
  if (minecraftProcess) return res.json({ status: 'already running' })

  minecraftProcess = spawn('java', ['-Xmx4G', '-Xms4G', '-jar', 'server.jar', 'nogui'], {
    cwd: '/app/mcsv',
    env: javaEnv
  })

  minecraftProcess.stdout.on('data', (data) => {
    io.emit('log', data.toString())
  })

  minecraftProcess.stderr.on('data', (data) => {
    io.emit('log', data.toString())
  })

  minecraftProcess.on('close', () => {
    io.emit('log', 'Servidor detenido.')
    minecraftProcess = null
  })

  res.json({ status: 'started' })
})

app.post('/stop', (req, res) => {
  if (!minecraftProcess) return res.json({ status: 'not running' })
  minecraftProcess.kill()
  res.json({ status: 'stopped' })
})

io.on('connection', (socket) => {
  socket.emit('log', 'Conectado a la consola...')
})

app.post("/install", async (req, res) => {
  try {
    await exec(download, { shell: "/bin/bash", env: javaEnv })
    console.log("Server downloaded successfully")
    await exec(execute, { shell: "/bin/bash", env: javaEnv })
    console.log("EULA created successfully")
    fs.writeFileSync("mcsv/eula.txt", "eula=true")
    console.log("EULA signed successfully")
    res.status(201).send("Server installed successfully")
  } catch (error) {
    console.error("Error installing server:", error)
    res.status(500).send("Error installing server")
  }
})

httpServer.listen(port, () => {
  console.log(`Server running at port ${port}`)
})
