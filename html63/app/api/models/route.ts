import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export const runtime = "nodejs"

const getModelsPath = () => {
  return process.env.MODELS_JSON || join(process.cwd(), "share", "models.json")
}

export async function GET() {
  try {
    const modelsPath = getModelsPath()
    console.log("[v0] Reading models from:", modelsPath)

    const fileContent = await readFile(modelsPath, "utf-8")
    const data = JSON.parse(fileContent)

    console.log("[v0] ✓ Successfully loaded models.json")
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] ✗ Error reading models.json:", error)
    return NextResponse.json({ models: [] }, { status: 500 })
  }
}
