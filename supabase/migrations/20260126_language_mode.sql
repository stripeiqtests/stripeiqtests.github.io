-- Add language_mode setting
-- Values: 'ru' (Russian only), 'en' (English only), 'bilingual' (user can switch)
-- Default: 'ru' (Russian only for all users)

INSERT INTO app_settings (key, value) 
VALUES ('language_mode', 'ru')
ON CONFLICT (key) DO NOTHING;
