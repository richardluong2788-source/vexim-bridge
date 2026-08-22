-- ============================================================
-- Muc 11 (moi): Nhan su san xuat, gio lam viec, ATTP/thiet bi,
-- nguon nuoc va vi tri nha may (danh gia rui ro lao dong/moi truong)
-- ============================================================

ALTER TABLE client_factory_assessments
    ADD COLUMN IF NOT EXISTS staff_engineers_count INTEGER,
    ADD COLUMN IF NOT EXISTS staff_workers_count INTEGER,
    ADD COLUMN IF NOT EXISTS work_hours_start TEXT,
    ADD COLUMN IF NOT EXISTS work_hours_end TEXT,
    ADD COLUMN IF NOT EXISTS work_days_per_week INTEGER,
    ADD COLUMN IF NOT EXISTS food_safety_training_regular BOOLEAN,
    ADD COLUMN IF NOT EXISTS equipment_calibration_regular BOOLEAN,
    ADD COLUMN IF NOT EXISTS water_source TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS water_source_other TEXT,
    ADD COLUMN IF NOT EXISTS water_testing BOOLEAN,
    ADD COLUMN IF NOT EXISTS near_pollution_source BOOLEAN,
    ADD COLUMN IF NOT EXISTS pollution_source_note TEXT;

COMMENT ON COLUMN client_factory_assessments.staff_engineers_count IS 'So luong ky su/nhan vien ky thuat';
COMMENT ON COLUMN client_factory_assessments.staff_workers_count IS 'So luong cong nhan san xuat';
COMMENT ON COLUMN client_factory_assessments.work_hours_start IS 'Gio bat dau ca lam viec (HH:mm)';
COMMENT ON COLUMN client_factory_assessments.work_hours_end IS 'Gio ket thuc ca lam viec (HH:mm)';
COMMENT ON COLUMN client_factory_assessments.work_days_per_week IS 'So ngay lam viec / tuan';
COMMENT ON COLUMN client_factory_assessments.food_safety_training_regular IS 'Co dao tao/tap huan ATTP dinh ky khong';
COMMENT ON COLUMN client_factory_assessments.equipment_calibration_regular IS 'Co kiem tra/kiem dinh may moc dinh ky khong';
COMMENT ON COLUMN client_factory_assessments.water_source IS 'Nguon nuoc su dung: municipal, well, filtered, other';
COMMENT ON COLUMN client_factory_assessments.water_testing IS 'Nguon nuoc co duoc kiem dinh dinh ky khong';
COMMENT ON COLUMN client_factory_assessments.near_pollution_source IS 'Nha may co gan nguon o nhiem (khu cong nghiep nang, bai rac, song o nhiem...) khong';
COMMENT ON COLUMN client_factory_assessments.pollution_source_note IS 'Ghi chu ve vi tri / nguon o nhiem gan nha may (neu co)';
