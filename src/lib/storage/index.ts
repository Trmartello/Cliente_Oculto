import "server-only";

export interface StorageDriver {
  put(key: string, dados: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

let driver: StorageDriver | null = null;

/**
 * Seleciona o driver de armazenamento por env var. Em produção (Railway o
 * filesystem é efêmero) use STORAGE_DRIVER=s3 com um provedor S3-compatível
 * (Cloudflare R2, Backblaze B2, MinIO); "local" serve para desenvolvimento.
 */
export async function storage(): Promise<StorageDriver> {
  if (driver) return driver;
  if (process.env.STORAGE_DRIVER === "s3") {
    const { S3Driver } = await import("./s3");
    driver = new S3Driver();
  } else {
    const { LocalDriver } = await import("./local");
    driver = new LocalDriver();
  }
  return driver;
}
