-- Agent Promotion to Hub: tracks when an agent is promoted to a Hub role
-- Once promotedAt is set the agent is removed from the Operations roster
-- and their portal credentials are revoked.
ALTER TABLE workforce_agents ADD COLUMN promotedAt BIGINT NULL;
