-- AlterTable
ALTER TABLE `Resposta` ADD COLUMN `comentarioEnviado` TEXT NULL,
    ADD COLUMN `naoSeAplicaEnviado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `snapshotEnvioEm` DATETIME(3) NULL,
    ADD COLUMN `valorEnviado` TEXT NULL;
