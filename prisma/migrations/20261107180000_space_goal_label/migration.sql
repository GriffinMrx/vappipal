-- Spaces: optional goal label ("Exam", "Presentation", …). Model/field renames
-- (Subject→Space, examDate→goalDate, subjectId→spaceId, StudyPlanDay→PlanDay,
-- EXAM_PASS→PASS) are code-only via @map/@@map; tables and columns are unchanged.
ALTER TABLE "Subject" ADD COLUMN "goalLabel" TEXT;

-- Existing goal dates were exam dates.
UPDATE "Subject" SET "goalLabel" = 'Exam' WHERE "examDate" IS NOT NULL;
