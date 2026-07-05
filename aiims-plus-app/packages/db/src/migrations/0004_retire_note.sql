-- ============================================================================
-- 0004_retire_note — remove the Stage 0 walking-skeleton proof table.
--
-- platform.note existed solely to prove the audited tenant-scoped write path
-- (Master Plan §10) and was marked for removal when the first real module
-- landed. Stage 1's platform modules (organization/facility/department/user)
-- now carry the same guarantee. Its rls-policies.json entry is removed in the
-- same commit (a reviewed manifest change, DDR-0011).
-- ============================================================================

DROP TABLE IF EXISTS platform.note;
