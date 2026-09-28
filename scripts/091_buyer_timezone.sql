-- ============================================================================
-- Migration 091: Buyer timezone (sending window theo giờ địa phương buyer)
-- ============================================================================
-- B1 sending window: Mon–Fri, 08:00–11:30 và 13:00–16:30 GIỜ LOCAL của buyer.
-- - cột này là OVERRIDE thủ công (admin đặt IANA timezone, VD America/Chicago).
-- - NULL = lib/campaign/sending-window.ts tự derive từ country/import_address:
--     manual > US-state (từ import_address) > country map > approximate.
-- - Timezone không đủ tin cậy → KHÔNG auto-send (chỉ AE gửi tay, shadow mode).
-- - AI không bao giờ quyết định giờ gửi — window là policy thuần backend.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_timezone TEXT;

COMMENT ON COLUMN public.leads.buyer_timezone IS
  'IANA timezone override for the sending window (e.g. America/Chicago). NULL = derived from country/import_address in lib/campaign/sending-window.ts (manual > US state > country map > approximation). Unknown/unreliable timezone blocks CAMPAIGN_AUTO_SEND.';
