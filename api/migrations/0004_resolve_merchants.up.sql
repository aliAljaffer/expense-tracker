-- Migration 0004: Resolve merchants for transactions
-- Merchant resolution (finding/creating merchants and setting merchant_id) is performed
-- in Go after migrations run, using the same normalizer as the importer.
-- This migration is a placeholder for versioning only.
select 1;
