-- 1) Dedupe de planos canônicos (posto+etapa) antes do índice único:
--    reaponta as iniciativas dos duplicados para o plano mais antigo e
--    remove os demais (duplicatas só surgem por corrida na geração).
CREATE TEMPORARY TABLE `_planos_canonicos` AS
SELECT `postoId`, `blocoNome`,
       SUBSTRING_INDEX(GROUP_CONCAT(`id` ORDER BY `criadoEm` ASC, `id` ASC), ',', 1) AS `id`
FROM `PlanoAcao`
WHERE `blocoNome` IS NOT NULL
GROUP BY `postoId`, `blocoNome`;

UPDATE `IniciativaPlano` ip
JOIN `PlanoAcao` pa ON pa.`id` = ip.`planoId` AND pa.`blocoNome` IS NOT NULL
JOIN `_planos_canonicos` c ON c.`postoId` = pa.`postoId` AND c.`blocoNome` = pa.`blocoNome`
SET ip.`planoId` = c.`id`
WHERE pa.`id` <> c.`id`;

DELETE pa FROM `PlanoAcao` pa
JOIN `_planos_canonicos` c ON c.`postoId` = pa.`postoId` AND c.`blocoNome` = pa.`blocoNome`
WHERE pa.`id` <> c.`id`;

DROP TEMPORARY TABLE `_planos_canonicos`;

-- 2) Troca o índice comum pelo ÚNICO (o get-or-create do plano canônico
--    passa a ser garantido pelo banco). O FK de postoId é recriado por
--    cima do novo índice.
ALTER TABLE `PlanoAcao` DROP FOREIGN KEY `PlanoAcao_postoId_fkey`;
DROP INDEX `PlanoAcao_postoId_blocoNome_idx` ON `PlanoAcao`;
CREATE UNIQUE INDEX `PlanoAcao_postoId_blocoNome_key` ON `PlanoAcao`(`postoId`, `blocoNome`);
ALTER TABLE `PlanoAcao` ADD CONSTRAINT `PlanoAcao_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Prazos passam a ser DATA PURA (meia-noite UTC) — semântica única de
--    vencimento em Brasília (ver src/lib/prazos.ts).
UPDATE `AcaoPlano` SET `dataLimite` = CAST(DATE(`dataLimite`) AS DATETIME(3)) WHERE `dataLimite` IS NOT NULL;
UPDATE `NaoConformidade` SET `prazo` = CAST(DATE(`prazo`) AS DATETIME(3)) WHERE `prazo` IS NOT NULL;
UPDATE `Acao` SET `prazo` = CAST(DATE(`prazo`) AS DATETIME(3)) WHERE `prazo` IS NOT NULL;
