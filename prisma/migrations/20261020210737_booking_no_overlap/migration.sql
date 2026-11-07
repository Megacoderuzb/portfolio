-- Final guard against double booking: two non-cancelled bookings can never overlap in time.
-- Not expressible in schema.prisma. Violations raise SQLSTATE 23P01 (exclusion_violation) → HTTP 409 slot_taken.
-- Range types work with GiST without extra extensions.
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED');
