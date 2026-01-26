-- Add image URLs to questions 11-21
-- Note: Some questions originally had multiple images, using primary image only
-- Questions 11, 12, 17, 19, 21 had multiple images in source

-- First, get the test_id for "Полный IQ тест"
-- Then update questions by order number

UPDATE questions
SET image_url = '/question_images/q11_1.gif'
WHERE order_number = 11
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q12_1.gif'
WHERE order_number = 12
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q13.gif'
WHERE order_number = 13
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q14.gif'
WHERE order_number = 14
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q15.gif'
WHERE order_number = 15
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q16.gif'
WHERE order_number = 16
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q17_1.gif'
WHERE order_number = 17
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

-- Question 18 is marked to skip in source, but adding image anyway
UPDATE questions
SET image_url = '/question_images/q18.gif'
WHERE order_number = 18
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q19_1.gif'
WHERE order_number = 19
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q20.gif'
WHERE order_number = 20
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);

UPDATE questions
SET image_url = '/question_images/q21_1.gif'
WHERE order_number = 21
AND test_id = (SELECT id FROM tests WHERE title = 'Полный IQ тест' LIMIT 1);
