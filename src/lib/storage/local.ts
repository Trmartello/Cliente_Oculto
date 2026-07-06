import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./index";

const RAIZ = path.join(process.cwd(), "storage", "uploads");

export class LocalDriver implements StorageDriver {
  private caminho(key: string): string {
    const seguro = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
    return path.join(RAIZ, seguro);
  }

  async put(key: string, dados: Buffer): Promise<void> {
    const destino = this.caminho(key);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, dados);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.caminho(key));
  }
}
