-- Home Content table for editable home page content
CREATE TABLE IF NOT EXISTS home_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default content (matching current hardcoded values)
INSERT INTO home_content (key, value) VALUES
  ('hero_title_en', 'Discover Your Cognitive Profile'),
  ('hero_title_ru', 'Раскройте свой когнитивный профиль'),
  ('hero_subtitle_en', 'Take our comprehensive IQ test and unlock detailed insights into your cognitive strengths across four key dimensions'),
  ('hero_subtitle_ru', 'Пройдите наш комплексный IQ тест и получите детальный анализ ваших когнитивных способностей по четырём ключевым измерениям'),
  ('footer_en', 'This test is for entertainment purposes only and does not constitute a professional psychological assessment.'),
  ('footer_ru', 'Этот тест предназначен только для развлечения и не является профессиональной психологической оценкой.'),
  -- Feature cards
  ('feature1_title_en', '10-15 Minutes'),
  ('feature1_title_ru', '10-15 минут'),
  ('feature1_desc_en', 'Quick and efficient assessment'),
  ('feature1_desc_ru', 'Быстрая и эффективная оценка'),
  ('feature2_title_en', '20-25 Questions'),
  ('feature2_title_ru', '20-25 вопросов'),
  ('feature2_desc_en', 'Comprehensive evaluation'),
  ('feature2_desc_ru', 'Комплексная оценка'),
  ('feature3_title_en', '4 Dimensions'),
  ('feature3_title_ru', '4 измерения'),
  ('feature3_desc_en', 'Analyst, Strategist, Observer, Intuitive'),
  ('feature3_desc_ru', 'Аналитик, Стратег, Наблюдатель, Интуит'),
  ('feature4_title_en', 'Visual Puzzles'),
  ('feature4_title_ru', 'Визуальные задачи'),
  ('feature4_desc_en', 'Logic + visual reasoning tasks'),
  ('feature4_desc_ru', 'Логика + визуальное мышление'),
  -- Payment Success Page
  ('payment_success_title_en', 'Payment Successful!'),
  ('payment_success_title_ru', 'Оплата прошла успешно!'),
  ('payment_success_processing_en', 'Processing your results...'),
  ('payment_success_processing_ru', 'Обрабатываем ваши результаты...'),
  ('payment_error_en', 'Something went wrong. Please contact support.'),
  ('payment_error_ru', 'Что-то пошло не так. Свяжитесь с поддержкой.'),
  -- Payment Cancel Page
  ('payment_cancel_title_en', 'Payment Cancelled'),
  ('payment_cancel_title_ru', 'Оплата отменена'),
  ('payment_cancel_message_en', 'Your payment was cancelled. You can try again anytime.'),
  ('payment_cancel_message_ru', 'Оплата была отменена. Вы можете попробовать снова в любое время.'),
  ('try_again_button_en', 'Try Again'),
  ('try_again_button_ru', 'Попробовать снова'),
  ('back_to_home_en', 'Back to Home'),
  ('back_to_home_ru', 'На главную'),
  -- Results Page (session not found)
  ('session_not_found_title_en', 'Session Not Found'),
  ('session_not_found_title_ru', 'Сессия не найдена'),
  ('session_not_found_message_en', 'This test session doesn''t exist or has expired.'),
  ('session_not_found_message_ru', 'Эта тестовая сессия не существует или истекла.'),
  ('take_new_test_en', 'Take a New Test'),
  ('take_new_test_ru', 'Пройти новый тест'),
  -- Results Page (unlock)
  ('test_completed_title_en', 'Test Completed!'),
  ('test_completed_title_ru', 'Тест завершён!'),
  ('unlock_results_en', 'Unlock your detailed results'),
  ('unlock_results_ru', 'Разблокируйте ваши подробные результаты'),
  ('one_time_payment_en', 'One-time payment'),
  ('one_time_payment_ru', 'Единовременный платёж'),
  ('secure_payment_en', 'Secure payment powered by Stripe'),
  ('secure_payment_ru', 'Безопасная оплата через Stripe')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE home_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Allow read home_content" ON home_content FOR SELECT USING (true);

-- Anyone can update (admin check is done client-side via password)
CREATE POLICY "Allow update home_content" ON home_content FOR UPDATE USING (true);

-- Grant permissions
GRANT SELECT, UPDATE ON home_content TO anon;
