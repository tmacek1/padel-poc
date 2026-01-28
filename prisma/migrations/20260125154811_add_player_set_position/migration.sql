-- CreateTable
CREATE TABLE "SetPlayerPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchSetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courtSide" TEXT NOT NULL,
    CONSTRAINT "SetPlayerPosition_matchSetId_fkey" FOREIGN KEY ("matchSetId") REFERENCES "MatchSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SetPlayerPosition_matchSetId_userId_key" ON "SetPlayerPosition"("matchSetId", "userId");
