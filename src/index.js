import express from "express"
import util from "node:util"
import child_process from "node:child_process"
import fs from "node:fs"

const app = express()
const port = 3000
const download = `mkdir -p mcsv && wget -O mcsv/server.jar https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar`
const execute = `cd mcsv && java -Xmx4G -Xms4G -jar server.jar nogui`

app.set("view engine", "ejs")
app.set("views", "src/views")

app.get("/", (req, res) => {
    res.render("index")
})

const exec = util.promisify(child_process.exec)

app.get("/run", async (req, res) => {
    const { stdout, stderr } = await exec("ls -lh")
    res.send(stdout)
})

app.get("/install", async (req, res) => {
    try {
        await exec(download, { shell: "/bin/bash" })
        console.log("Server downloaded successfully")

        await exec(execute, { shell: "/bin/bash" })
        console.log("EULA created successfully")

        fs.writeFileSync("mcsv/eula.txt", "eula=true")
        console.log("EULA signed successfully")

        res.status(201).send("Server installed successfully")
    } catch (error) {
        console.error("Error installing server:", error)
        res.status(500).send("Error installing server")
    }
})

app.listen(port, () => {
    console.log(`Server running at port ${port}`)
})
