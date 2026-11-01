-- FundBridge AI — one-time database bootstrap.
--
-- Run this ONCE as the PostgreSQL superuser. It creates a least-privilege
-- application role and an empty database owned by that role. Prisma Migrate
-- then creates every table as the application role, so the application never
-- needs superuser rights at runtime (docs/security/security-architecture.md).
--
--   psql -U postgres -h localhost -f scripts/setup/01-create-database.sql
--
-- Replace CHANGE_ME_STRONG_PASSWORD below before running.

\set app_password 'CHANGE_ME_STRONG_PASSWORD'

-- Application role: can log in, owns the schema, but is NOT a superuser and
-- cannot create other roles or databases.
CREATE ROLE fundbridge WITH LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

CREATE DATABASE fundbridge WITH OWNER fundbridge ENCODING 'UTF8';

-- Shadow database used by `prisma migrate dev` to diff migrations safely.
CREATE DATABASE fundbridge_shadow WITH OWNER fundbridge ENCODING 'UTF8';

\connect fundbridge

-- Revoke the implicit public-schema rights PostgreSQL grants by default, then
-- grant them back to the application role only.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO fundbridge;

\echo ''
\echo 'Done. Database "fundbridge" created and owned by role "fundbridge".'
\echo 'Next: put this in backend/.env (substituting your password):'
\echo '  DATABASE_URL="postgresql://fundbridge:<password>@localhost:5432/fundbridge?schema=public"'
\echo '  SHADOW_DATABASE_URL="postgresql://fundbridge:<password>@localhost:5432/fundbridge_shadow?schema=public"'
