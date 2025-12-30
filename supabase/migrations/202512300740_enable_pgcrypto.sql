-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;
