-- Add accommodation_area to trips table
-- Run this in the Supabase SQL editor

alter table public.trips
  add column if not exists accommodation_area text;
