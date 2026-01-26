-- Create archetype_results table for storing archetype descriptions
CREATE TABLE IF NOT EXISTS archetype_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL UNIQUE CHECK (dimension IN ('analyst', 'strategist', 'observer', 'intuitive')),
  title_ru TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  content_ru TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE archetype_results ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON archetype_results
  FOR SELECT USING (true);

-- Allow all operations (for authenticated/admin users via anon key with password check in app)
CREATE POLICY "Allow all operations" ON archetype_results
  FOR ALL USING (true);

-- Insert default entries for all four dimensions
INSERT INTO archetype_results (dimension, title_ru, title_en, content_ru, content_en) VALUES
('analyst', '🧠 ОБРАЗ МЫШЛЕНИЯ: АНАЛИТИК', '🧠 THINKING STYLE: ANALYST', 
'**Как вы думаете**

Вы мыслите логически, структурно и последовательно.
Вам важно понимать причины, связи и последствия.
Вы не любите хаос, догадки без опоры и решения «на эмоциях». Твоё мышление логичное, структурное и рациональное. Ты хорошо работаешь с информацией, числами и системами. Любишь порядок, последовательность и ясность. Часто именно ты — тот, кто «всё раскладывает по полочкам».

**Вы склонны:**
• анализировать перед действием
• искать закономерности, формулы и системы
• сомневаться, если данных недостаточно

**Сильные стороны**
• умение находить ошибки
• взвешенные, рациональные решения
• логика и точность
• системное мышление
• высокий интеллектуальный контроль

**Теневая сторона**
• переизбыток контроля
• застревание в размышлениях
• сложность довериться чувствам и спонтанности

**Рекомендации**
• развивать гибкость
• позволять себе интуитивные решения
• не обесценивать эмоции

Ваш тип мышления чаще всего проявляется через такие архетипические образы:
Женские: «Жрица» «Королева»
Мужские: «Маг(Мудрец)» «Монарх(Король)»',
'**How you think**

You think logically, structurally and sequentially.
It is important for you to understand causes, connections and consequences.
You don''t like chaos, guesses without support and decisions "based on emotions". Your thinking is logical, structured and rational. You work well with information, numbers and systems. You love order, consistency and clarity. Often you are the one who "puts everything in its place".

**You tend to:**
• analyze before acting
• look for patterns, formulas and systems
• doubt if there is not enough data

**Strengths**
• ability to find errors
• balanced, rational decisions
• logic and accuracy
• systems thinking
• high intellectual control

**Shadow side**
• excessive control
• getting stuck in thoughts
• difficulty trusting feelings and spontaneity

**Recommendations**
• develop flexibility
• allow intuitive decisions
• don''t devalue emotions

Your thinking type is most often manifested through these archetypal images:
Female: "Priestess" "Queen"
Male: "Magician (Sage)" "Monarch (King)"'),

('strategist', '🧠 ОБРАЗ МЫШЛЕНИЯ: СТРАТЕГ', '🧠 THINKING STYLE: STRATEGIST',
'**Как вы думаете**

Вы мыслите целями, ходами и результатами.
Для вас важно не просто понять, а **дойти до нужной точки**.
У вас высокоуровневое мышление. Вы не просто решаете задачи — вы видите системы, последствия и ходы на несколько шагов вперёд. Такой тип интеллекта свойственен лидерам, архитекторам решений и людям, влияющим на процессы.

**Вы склонны:**
• видеть на несколько шагов вперёд
• просчитывать сценарии
• управлять процессами и решениями

**Сильные стороны**
• стратегическое мышление
• умение принимать решения
• лидерская логика
• высокая скорость анализа
• видение целого
• способность управлять сложными системами

**Теневая сторона**
• эмоциональная отстранённость
• жёсткость
• желание всё контролировать

**Рекомендации**
• следить за перегрузкой
• делегировать
• развивать эмоциональный контакт с людьми

Ваш тип мышления чаще всего проявляется через такие архетипические образы:
Женские: «Воительница» «Королева»
Мужские: «Монарх (Король)» «Воин»',
'**How you think**

You think in terms of goals, moves and results.
For you, it''s important not just to understand, but to **reach the desired point**.
You have high-level thinking. You don''t just solve problems — you see systems, consequences and moves several steps ahead. This type of intelligence is characteristic of leaders, solution architects and people who influence processes.

**You tend to:**
• see several steps ahead
• calculate scenarios
• manage processes and decisions

**Strengths**
• strategic thinking
• decision-making ability
• leadership logic
• high analysis speed
• vision of the whole
• ability to manage complex systems

**Shadow side**
• emotional detachment
• rigidity
• desire to control everything

**Recommendations**
• monitor overload
• delegate
• develop emotional contact with people

Your thinking type is most often manifested through these archetypal images:
Female: "Warrior Woman" "Queen"
Male: "Monarch (King)" "Warrior"'),

('observer', '🧠 ОБРАЗ МЫШЛЕНИЯ: НАБЛЮДАТЕЛЬ', '🧠 THINKING STYLE: OBSERVER',
'**Как вы думаете**

Вы сначала смотрите, чувствуете и замечаете, и только потом делаете выводы.
Ты мыслящий аналитик, но предпочитаешь не спешить. Ты смотришь, сопоставляешь, взвешиваешь. Иногда откладываешь решения, потому что хочешь увидеть полную картину. Твоё мышление гибкое и адаптивное.

**Вы склонны:**
• видеть нюансы и детали
• чувствовать атмосферу
• улавливать скрытые мотивы людей

**Сильные стороны**
• глубокое понимание других
• эмпатия
• способность видеть правду между строк
• анализировать без эмоций
• умение видеть несколько вариантов
• спокойствие в сложных ситуациях

**Теневая сторона**
• откладывание действий
• уход в позицию «со стороны»
• сомнения в собственной значимости

**Рекомендации**
• учиться быстрее принимать решения
• доверять первому выводу
• не застревать в анализе

Ваш тип мышления чаще всего проявляется через такие архетипические образы:
Женские: «Жрица» «Мать»
Мужские: «Маг (Мудрец)» «Исследователь (Проводник)»',
'**How you think**

You first look, feel and notice, and only then draw conclusions.
You are a thinking analyst, but you prefer not to rush. You look, compare, weigh. Sometimes you postpone decisions because you want to see the full picture. Your thinking is flexible and adaptive.

**You tend to:**
• see nuances and details
• feel the atmosphere
• catch hidden motives of people

**Strengths**
• deep understanding of others
• empathy
• ability to see the truth between the lines
• analyze without emotions
• ability to see multiple options
• calmness in difficult situations

**Shadow side**
• postponing actions
• retreating to the "sidelines" position
• doubts about your own significance

**Recommendations**
• learn to make decisions faster
• trust your first conclusion
• don''t get stuck in analysis

Your thinking type is most often manifested through these archetypal images:
Female: "Priestess" "Mother"
Male: "Magician (Sage)" "Explorer (Guide)"'),

('intuitive', '🧠 ОБРАЗ МЫШЛЕНИЯ: ИНТУИТ', '🧠 THINKING STYLE: INTUITIVE',
'**Как вы думаете**

Вы принимаете решения через ощущение, образ и внутренний отклик.
Часто вы **знаете**, но не всегда можете объяснить — почему.
Твоё мышление опирается прежде всего на ощущения, образы и внутренние сигналы. Ты схватываешь суть не через логику, а через чувство. Такой тип мышления характерен для людей, которые чувствуют людей и ситуации глубже, чем структуры и формулы.

**Вы склонны:**
• доверять чувствам
• идти за импульсом
• чувствовать верное направление

**Сильные стороны**
• креативность
• гибкость
• нестандартные решения
• развитая интуиция
• эмпатия и чувствительность
• способность видеть скрытые смыслы

**Теневая сторона**
• хаотичность
• сложности с дисциплиной
• зависимость от эмоций

**Рекомендации**
• развивать навык структурирования мыслей
• фиксировать идеи письменно
• сочетать интуицию с проверкой фактами

Ваш тип мышления чаще всего проявляется через такие архетипические образы:
Женские: «Любовница» «Принцесса»
Мужские: «Любовник» «Трикстер (Бунтарь)»',
'**How you think**

You make decisions through sensation, image and inner response.
Often you **know**, but you can''t always explain why.
Your thinking relies primarily on sensations, images and internal signals. You grasp the essence not through logic, but through feeling. This type of thinking is characteristic of people who feel people and situations deeper than structures and formulas.

**You tend to:**
• trust your feelings
• follow impulses
• sense the right direction

**Strengths**
• creativity
• flexibility
• unconventional solutions
• developed intuition
• empathy and sensitivity
• ability to see hidden meanings

**Shadow side**
• chaos
• difficulties with discipline
• dependence on emotions

**Recommendations**
• develop the skill of structuring thoughts
• write down ideas
• combine intuition with fact-checking

Your thinking type is most often manifested through these archetypal images:
Female: "Lover" "Princess"
Male: "Lover" "Trickster (Rebel)"')

ON CONFLICT (dimension) DO NOTHING;
