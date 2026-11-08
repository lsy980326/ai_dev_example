CREATE ROLE study_migrator LOGIN PASSWORD 'test-migration-only';
CREATE ROLE study_app LOGIN PASSWORD 'test-app-only';
GRANT USAGE, CREATE ON SCHEMA public TO study_migrator;
GRANT USAGE ON SCHEMA public TO study_app;
