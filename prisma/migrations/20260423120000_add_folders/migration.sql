CREATE TABLE "folder" (
    "id" VARCHAR(32) PRIMARY KEY,
    "user_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "fk_folder_user"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
    CONSTRAINT "ck_folder_name_length"
        CHECK (char_length("name") BETWEEN 1 AND 80)
);

CREATE INDEX "ix_folder_user_id_name"
    ON "folder" ("user_id", "name");

CREATE UNIQUE INDEX "ux_folder_user_lower_name"
    ON "folder" ("user_id", lower("name"));

ALTER TABLE "video"
    ADD COLUMN "folder_id" VARCHAR(32) NULL,
    ADD CONSTRAINT "fk_video_folder"
        FOREIGN KEY ("folder_id") REFERENCES "folder"("id") ON DELETE SET NULL;

CREATE INDEX "ix_video_user_folder_created"
    ON "video" ("user_id", "folder_id", "created_at" DESC);
