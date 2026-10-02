import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const root = process.cwd()
const source = path.join(root, "app", "icon.svg")
const output = path.join(root, "mobile", "assets")
const svg = await readFile(source)

await mkdir(output, { recursive: true })

await Promise.all([
  sharp(svg).resize(1024, 1024).flatten({ background: "#D4652A" }).png().toFile(path.join(output, "icon.png")),
  sharp(svg).resize(512, 512).flatten({ background: "#D4652A" }).png().toFile(path.join(output, "splash-icon.png")),
  sharp(svg).resize(64, 64).flatten({ background: "#D4652A" }).png().toFile(path.join(output, "favicon.png")),
])

console.log("Generated mobile icon, splash, and favicon assets.")
