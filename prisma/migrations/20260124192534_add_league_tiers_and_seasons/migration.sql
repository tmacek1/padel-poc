/*
  Warnings:

  - You are about to drop the column `endDate` on the `League` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `League` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN "tiebreakLossTeam" INTEGER;

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "minMatches" INTEGER NOT NULL DEFAULT 8,
    "promotionPercent" INTEGER NOT NULL DEFAULT 25,
    "relegationPercent" INTEGER NOT NULL DEFAULT 25,
    "pointsForWin" INTEGER NOT NULL DEFAULT 3,
    "pointsForTiebreakLoss" INTEGER NOT NULL DEFAULT 1,
    "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueTeamId" TEXT,
    "userId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tiebreakLosses" INTEGER NOT NULL DEFAULT 0,
    "setsWon" INTEGER NOT NULL DEFAULT 0,
    "setsLost" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesLost" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "promotedToLeagueId" TEXT,
    "relegatedToLeagueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonStanding_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonStanding_leagueTeamId_fkey" FOREIGN KEY ("leagueTeamId") REFERENCES "LeagueTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonStanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "tierOrder" INTEGER NOT NULL DEFAULT 1,
    "seasonId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "League_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_League" ("createdAt", "description", "id", "isActive", "name", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "updatedAt" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStanding_seasonId_leagueId_leagueTeamId_key" ON "SeasonStanding"("seasonId", "leagueId", "leagueTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStanding_seasonId_leagueId_userId_key" ON "SeasonStanding"("seasonId", "leagueId", "userId");
