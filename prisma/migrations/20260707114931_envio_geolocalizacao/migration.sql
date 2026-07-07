-- AlterTable
ALTER TABLE `Visita` ADD COLUMN `envioLatitude` DECIMAL(9, 6) NULL,
    ADD COLUMN `envioLongitude` DECIMAL(9, 6) NULL,
    ADD COLUMN `envioPrecisaoM` INTEGER NULL;
