-- Production-safe restoration for the existing `iq-test` content.
-- The stable question IDs were compared with LIVE on 2026-07-18.

begin;

do $$
declare
  iq_test_id uuid;
  iq_test_count integer;
  matched_question_count integer;
begin
  select count(*)
  into iq_test_count
  from public.tests
  where slug = 'iq-test';

  if iq_test_count = 0 then
    raise notice 'iq-test is not present yet; the recovery seed will provide the restored content';
    return;
  end if;

  if iq_test_count <> 1 then
    raise exception 'Safety check failed: expected one iq-test, found %', iq_test_count;
  end if;

  select id into iq_test_id from public.tests where slug = 'iq-test';

  select count(*) into matched_question_count
  from public.questions
  where test_id = iq_test_id
    and id in (
      '1be5fbb5-adc7-40c6-9c5e-7d58b03a6256',
      'e3279f76-8ee5-4fbc-bca2-39d827ddf7fd',
      '5a03a3d3-82cb-4677-8cc3-0463e347f72d',
      '17cdcf73-d70e-4d74-b312-dcb78326439e',
      'f60cc77a-7c3d-4707-b05a-8f6e6ea646df',
      '038136e2-ad5d-465b-878a-0ec534fe6d49',
      'e116ba16-4fc7-427c-83d3-aff192c18419',
      '6e4751bb-b099-46a4-b03b-5da0f6fbc618',
      '86643dbf-e7d3-47d8-84c6-82cde78668db',
      'dce717bd-8a56-43af-8515-99dfae9d2171',
      '92e2fcb9-4b80-43ee-8642-fdb99651dfc8',
      '53f5ff47-de50-480d-a776-76708e9253e2',
      '98daaf7b-7816-44d9-9d96-d7e21eadf85c',
      'e22436d1-18f0-4935-8f29-08c1b4ddeb24',
      '82782a3c-17b9-488c-8b16-6d95a520dc22',
      '817b36b2-888d-48b5-ac61-fcad52116a26',
      '72332294-5f7d-4e41-ab40-341495579276',
      '3c6321bc-9246-4ead-84db-1be36975d269',
      '910c225b-9914-4933-9bec-1d2b24e47025',
      '987be331-c4da-4792-b7e3-d6c862b117da',
      'e01739dd-e31e-4cc4-9284-41a58223ffcf'
    );

  if matched_question_count <> 21 then
    raise exception 'Safety check failed: expected 21 known iq-test questions, found %', matched_question_count;
  end if;
end
$$;

-- Restore the primary image path for every visual question. The frontend expands
-- these primary paths to the complete 17-file image set where a question has
-- multiple panels.
update public.questions
set image_url = case id
  when '92e2fcb9-4b80-43ee-8642-fdb99651dfc8' then '/question_images/q11_1.gif'
  when '53f5ff47-de50-480d-a776-76708e9253e2' then '/question_images/q12_1.gif'
  when '98daaf7b-7816-44d9-9d96-d7e21eadf85c' then '/question_images/q13.gif'
  when 'e22436d1-18f0-4935-8f29-08c1b4ddeb24' then '/question_images/q14.gif'
  when '82782a3c-17b9-488c-8b16-6d95a520dc22' then '/question_images/q15.gif'
  when '817b36b2-888d-48b5-ac61-fcad52116a26' then '/question_images/q16.gif'
  when '72332294-5f7d-4e41-ab40-341495579276' then '/question_images/q17_1.gif'
  when '3c6321bc-9246-4ead-84db-1be36975d269' then '/question_images/q18.gif'
  when '910c225b-9914-4933-9bec-1d2b24e47025' then '/question_images/q19_1.gif'
  when '987be331-c4da-4792-b7e3-d6c862b117da' then '/question_images/q20.gif'
  when 'e01739dd-e31e-4cc4-9284-41a58223ffcf' then '/question_images/q21_1.gif'
end
where id in (
  '92e2fcb9-4b80-43ee-8642-fdb99651dfc8',
  '53f5ff47-de50-480d-a776-76708e9253e2',
  '98daaf7b-7816-44d9-9d96-d7e21eadf85c',
  'e22436d1-18f0-4935-8f29-08c1b4ddeb24',
  '82782a3c-17b9-488c-8b16-6d95a520dc22',
  '817b36b2-888d-48b5-ac61-fcad52116a26',
  '72332294-5f7d-4e41-ab40-341495579276',
  '3c6321bc-9246-4ead-84db-1be36975d269',
  '910c225b-9914-4933-9bec-1d2b24e47025',
  '987be331-c4da-4792-b7e3-d6c862b117da',
  'e01739dd-e31e-4cc4-9284-41a58223ffcf'
);

-- Move visual and text questions into a balanced order. A temporary range avoids
-- collisions with the unique (test_id, question_number) constraint.
update public.questions
set question_number = question_number + 100
where test_id = (select id from public.tests where slug = 'iq-test');

update public.questions
set question_number = case id
  when '1be5fbb5-adc7-40c6-9c5e-7d58b03a6256' then 1
  when '92e2fcb9-4b80-43ee-8642-fdb99651dfc8' then 2
  when 'e3279f76-8ee5-4fbc-bca2-39d827ddf7fd' then 3
  when '53f5ff47-de50-480d-a776-76708e9253e2' then 4
  when '5a03a3d3-82cb-4677-8cc3-0463e347f72d' then 5
  when '98daaf7b-7816-44d9-9d96-d7e21eadf85c' then 6
  when '17cdcf73-d70e-4d74-b312-dcb78326439e' then 7
  when 'e22436d1-18f0-4935-8f29-08c1b4ddeb24' then 8
  when 'f60cc77a-7c3d-4707-b05a-8f6e6ea646df' then 9
  when '82782a3c-17b9-488c-8b16-6d95a520dc22' then 10
  when '038136e2-ad5d-465b-878a-0ec534fe6d49' then 11
  when '817b36b2-888d-48b5-ac61-fcad52116a26' then 12
  when 'e116ba16-4fc7-427c-83d3-aff192c18419' then 13
  when '72332294-5f7d-4e41-ab40-341495579276' then 14
  when '6e4751bb-b099-46a4-b03b-5da0f6fbc618' then 15
  when '3c6321bc-9246-4ead-84db-1be36975d269' then 16
  when '86643dbf-e7d3-47d8-84c6-82cde78668db' then 17
  when '910c225b-9914-4933-9bec-1d2b24e47025' then 18
  when 'dce717bd-8a56-43af-8515-99dfae9d2171' then 19
  when '987be331-c4da-4792-b7e3-d6c862b117da' then 20
  when 'e01739dd-e31e-4cc4-9284-41a58223ffcf' then 21
end
where test_id = (select id from public.tests where slug = 'iq-test');

-- Owner-approved correction from the supplied conversation.
update public.questions
set
  question_text = $question$Какое число должно быть следующим?

3 — 6 — 12 — 24 — ?$question$,
  options = '[{"label":"A","value":"30"},{"label":"B","value":"36"},{"label":"C","value":"42"},{"label":"D","value":"48"}]'::jsonb,
  correct_answer = 'D'
where id = '17cdcf73-d70e-4d74-b312-dcb78326439e';

-- Convert the two visible characters "\n" from historic edits into line breaks.
update public.questions
set question_text = replace(question_text, E'\\n', E'\n')
where question_text like E'%\\n%';

-- Do not advertise an empty test on the home page.
update public.tests t
set is_active = false
where t.slug = 'arkhetipy'
  and not exists (
    select 1 from public.questions q where q.test_id = t.id
  );

do $$
declare
  iq_test_id uuid;
  iq_test_count integer;
  invalid_count integer;
begin
  select count(*)
  into iq_test_count
  from public.tests
  where slug = 'iq-test';

  if iq_test_count = 0 then
    return;
  end if;

  if iq_test_count <> 1 then
    raise exception 'Post-update validation failed: expected one iq-test, found %', iq_test_count;
  end if;

  select id into iq_test_id from public.tests where slug = 'iq-test';

  select count(*) into invalid_count
  from public.questions
  where test_id = iq_test_id
    and (
      question_number not between 1 and 21
      or question_text like E'%\\n%'
      or (question_number in (2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21) and image_url is null)
    );

  if invalid_count <> 0 then
    raise exception 'Post-update validation failed for % question rows', invalid_count;
  end if;

  if (select count(*) from public.questions where test_id = iq_test_id) <> 21 then
    raise exception 'Post-update validation failed: iq-test no longer has exactly 21 questions';
  end if;
end
$$;

commit;
