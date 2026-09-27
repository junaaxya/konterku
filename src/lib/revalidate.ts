import { revalidatePath } from "next/cache"

export function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path)
  } catch {
    return
  }
}
