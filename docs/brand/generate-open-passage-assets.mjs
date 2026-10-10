import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const brandDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(brandDirectory, "../..")
const source = await readFile(path.join(brandDirectory, "logo-concepts/02-open-passage.svg"))
const mobileAssets = path.join(projectRoot, "mobile/assets")

await Promise.all([
  sharp(source)
    .resize(1024, 1024)
    .flatten({ background: "#171512" })
    .png()
    .toFile(path.join(mobileAssets, "icon.png")),
  sharp(source)
    .resize(512, 512)
    .png()
    .toFile(path.join(mobileAssets, "splash-icon.png")),
  sharp(source)
    .resize(256, 256)
    .png()
    .toFile(path.join(mobileAssets, "brand-mark.png")),
  sharp(source)
    .resize(64, 64)
    .png()
    .toFile(path.join(mobileAssets, "favicon.png")),
])

const adaptiveForeground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g>
      <path d="M142 374V242c0-78 51-132 114-132s114 54 114 132v132" fill="none" stroke="#F3EFE7" stroke-width="30" stroke-linecap="round"/>
      <path d="M191 375c0-66 23-94 61-126 35-30 58-56 72-98" fill="none" stroke="#A65636" stroke-width="24" stroke-linecap="round"/>
      <circle cx="327" cy="141" r="18" fill="#C8A96E"/>
    </g>
  </svg>
`)

await sharp(adaptiveForeground)
  .resize(1024, 1024)
  .png()
  .toFile(path.join(mobileAssets, "adaptive-icon.png"))

console.log("Generated Open Passage mobile brand assets.")
