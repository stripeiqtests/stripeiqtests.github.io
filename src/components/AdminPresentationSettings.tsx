import { useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { usePresentation } from '../lib/usePresentation';
import { getProfileDescription } from '../lib/resultSummary';
import {
  defaultPresentation,
  type Dimension,
  dimensionNames,
  dimensions,
  type MessageKey,
  messageKeys,
  type Presentation,
  validPresentation,
} from '../../supabase/functions/_shared/presentation.ts';

const messageLabels: Record<MessageKey, { ru: string; en: string }> = {
  paymentConfirming: { ru: 'Подтверждение оплаты', en: 'Payment confirmation' },
  emailQueued: { ru: 'Письмо в очереди', en: 'Email queued' },
  emailSent: { ru: 'Письмо принято почтовым сервисом', en: 'Email accepted by the mail service' },
  emailFailed: { ru: 'Ошибка отправки письма', en: 'Email sending failed' },
  emailUnknown: { ru: 'Email без задания на отправку', en: 'Email without a delivery job' },
  profileNone: { ru: 'Нет ведущего измерения', en: 'No leading dimension' },
  profileMixed: { ru: 'Смешанный профиль', en: 'Mixed profile' },
};
export function AdminPresentationSettings() {
  const { lang } = useLanguage();
  const locale = lang === 'ru' ? 'ru' : 'en';
  const { presentation, loading, error, reload, save } = usePresentation();
  const [draft, setDraft] = useState<Presentation | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const value = draft ?? presentation;
  const update = (change: Partial<Presentation>) => {
    setDraft({ ...value, ...change });
    setSaved(false);
    setSaveError(false);
  };
  const zeros = { analyst_score: 0, strategist_score: 0, observer_score: 0, intuitive_score: 0 };
  const ties = {
    ...zeros,
    analyst_score: 80,
    strategist_score: 80,
    observer_score: 40,
    intuitive_score: 20,
  };
  return (
    <section aria-labelledby='presentation-heading' className='rounded-xl border bg-white p-6'>
      <h3 id='presentation-heading' className='mb-3 text-lg font-semibold'>
        {locale === 'ru' ? 'Спорные результаты и сообщения' : 'Ambiguous results and messages'}
      </h3>
      <p className='mb-4 text-sm text-gray-700'>
        {locale === 'ru'
          ? 'Правила действуют для всех тестов. Выберите, как показывать равные и нулевые результаты. Баллы и ответы не меняются. Правила используются при открытии результатов и подготовке новых писем. Уже подготовленные письма сохраняют прежнее содержимое.'
          : 'Rules apply to all tests. Choose how tied and zero results are presented. Scores and answers stay the same. Rules apply when results are opened and new emails are prepared. Prepared emails keep their original content.'}
      </p>
      {loading
        ? <p role='status'>{locale === 'ru' ? 'Загрузка…' : 'Loading…'}</p>
        : error
        ? (
          <div role='alert'>
            <p>
              {locale === 'ru'
                ? 'Не удалось загрузить правила. Повторите загрузку перед сохранением.'
                : 'Could not load the rules. Retry loading before saving.'}
            </p>
            <button onClick={() => void reload()} className='mt-2 rounded border px-3 py-2'>
              {locale === 'ru' ? 'Повторить загрузку правил' : 'Retry loading rules'}
            </button>
          </div>
        )
        : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              setSaved(false);
              setSaveError(false);
              if (!validPresentation(value)) {
                setSaveError(true);
                return;
              }
              setSaving(true);
              try {
                await save(value);
                setDraft(null);
                setSaved(true);
              } catch {
                setSaveError(true);
              } finally {
                setSaving(false);
              }
            }}
          >
            <fieldset disabled={saving} className='space-y-4'>
              <label className='block font-medium'>
                {locale === 'ru'
                  ? 'При одинаковом максимальном балле'
                  : 'When the highest scores are tied'}
                <select
                  value={value.ties}
                  onChange={(e) => update({ ties: e.target.value as Presentation['ties'] })}
                  className='mt-1 block w-full rounded border p-2'
                >
                  <option value='mixed'>
                    {locale === 'ru' ? 'Показывать смешанный профиль' : 'Show a mixed profile'}
                  </option>
                  <option value='priority'>
                    {locale === 'ru'
                      ? 'Выбирать по приоритету измерений'
                      : 'Choose by dimension priority'}
                  </option>
                </select>
              </label>
              {value.ties === 'priority' && (
                <fieldset className='rounded-lg border p-3'>
                  <legend className='px-1 font-medium'>
                    {locale === 'ru' ? 'Приоритет измерений' : 'Dimension priority'}
                  </legend>
                  <p className='mb-2 text-sm text-gray-700'>
                    {locale === 'ru'
                      ? 'Из измерений с максимальным баллом выбирается первое в этом порядке.'
                      : 'Among the tied highest dimensions, the first in this order is selected.'}
                  </p>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {value.priority.map((dimension, index) => (
                      <label key={index} className='text-sm'>
                        {locale === 'ru' ? `Приоритет ${index + 1}` : `Priority ${index + 1}`}
                        <select
                          value={dimension}
                          className='mt-1 block w-full rounded border p-2'
                          onChange={(e) => {
                            const priority = [...value.priority];
                            const other = priority.indexOf(e.target.value as Dimension);
                            [priority[index], priority[other]] = [priority[other], priority[index]];
                            update({ priority });
                          }}
                        >
                          {dimensions.map((d) => (
                            <option key={d} value={d}>{dimensionNames[d][locale]}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className='block font-medium'>
                {locale === 'ru'
                  ? 'Если все измеренные показатели равны нулю'
                  : 'When all measured scores are zero'}
                <select
                  value={value.zero}
                  onChange={(e) => update({ zero: e.target.value as Presentation['zero'] })}
                  className='mt-1 block w-full rounded border p-2'
                >
                  <option value='none'>
                    {locale === 'ru'
                      ? 'Не выбирать ведущее измерение'
                      : 'Do not choose a leading dimension'}
                  </option>
                  {dimensions.map((d) => (
                    <option key={d} value={d}>{dimensionNames[d][locale]}</option>
                  ))}
                </select>
              </label>
              <p className='text-sm text-gray-700'>
                {locale === 'ru'
                  ? 'При отсутствии данных направление не назначается. Для нулевого результата выбирается только измерение, по которому есть данные.'
                  : 'Missing data never assigns a dimension. A zero-result fallback is used only if that dimension was measured.'}
              </p>
              <details className='rounded-lg border p-3'>
                <summary className='cursor-pointer font-medium'>
                  {locale === 'ru'
                    ? 'Тексты сообщений — русский и английский'
                    : 'Message text — Russian and English'}
                </summary>
                <p className='my-3 text-sm text-gray-700'>
                  {locale === 'ru'
                    ? 'В сообщении смешанного профиля сохраните {dimensions}: вместо этой метки появятся названия измерений. К сообщениям о письмах адрес добавляется автоматически.'
                    : 'Keep {dimensions} in the mixed-profile message: it is replaced with dimension names. Email messages have the address appended automatically.'}
                </p>
                <div className='space-y-4'>
                  {messageKeys.map((key) => (
                    <div key={key} className='grid gap-3 md:grid-cols-2'>
                      {(['ru', 'en'] as const).map((language) => (
                        <label key={language} className='block text-sm font-medium'>
                          {messageLabels[key][locale]} — {language === 'ru' ? 'RU' : 'EN'}
                          <textarea
                            rows={2}
                            required
                            maxLength={1000}
                            value={value.messages[key][language]}
                            className='mt-1 block w-full rounded border p-2'
                            onChange={(e) =>
                              update({
                                messages: {
                                  ...value.messages,
                                  [key]: { ...value.messages[key], [language]: e.target.value },
                                },
                              })}
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
              <div
                aria-label={locale === 'ru' ? 'Предпросмотр правил' : 'Rules preview'}
                className='space-y-2 rounded-lg bg-indigo-50 p-4 text-gray-900'
              >
                <p className='font-semibold'>
                  {locale === 'ru' ? 'Предпросмотр правил' : 'Rules preview'}
                </p>
                <p>
                  {locale === 'ru'
                    ? 'Аналитик и Стратег — по 80: '
                    : 'Analyst and Strategist score 80: '}
                  {getProfileDescription(ties, locale, value)}
                </p>
                <p>
                  {locale === 'ru' ? 'Все показатели — 0: ' : 'All scores are 0: '}
                  {getProfileDescription(zeros, locale, value)}
                </p>
              </div>
              {saveError && (
                <p role='alert' className='text-red-800'>
                  {locale === 'ru'
                    ? 'Не удалось сохранить. Проверьте соединение, заполнение полей и метку {dimensions}.'
                    : 'Could not save. Check your connection, required fields and the {dimensions} placeholder.'}
                </p>
              )}
              <div className='flex flex-wrap items-center gap-3'>
                <button type='submit' className='rounded-lg bg-indigo-600 px-4 py-2 text-white'>
                  {saving
                    ? (locale === 'ru' ? 'Сохранение…' : 'Saving…')
                    : (locale === 'ru'
                      ? 'Сохранить правила и сообщения'
                      : 'Save rules and messages')}
                </button>
                <button
                  type='button'
                  className='rounded-lg border px-4 py-2'
                  onClick={() => update(defaultPresentation())}
                >
                  {locale === 'ru' ? 'Вернуть значения по умолчанию' : 'Restore defaults'}
                </button>
                {saved && (
                  <span role='status' className='text-green-800'>
                    {locale === 'ru' ? 'Правила сохранены' : 'Rules saved'}
                  </span>
                )}
              </div>
            </fieldset>
          </form>
        )}
    </section>
  );
}
