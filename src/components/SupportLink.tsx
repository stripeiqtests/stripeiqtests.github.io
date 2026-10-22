import { useSiteSettings, supportHref } from '../lib/siteSettings';
import { useLanguage } from '../lib/i18n';

export function SupportLink({ showContact = false }: { showContact?: boolean }) {
  const { supportContact } = useSiteSettings();
  const { lang } = useLanguage();
  return <a className="text-indigo-700 underline" href={supportHref(supportContact) ?? undefined}>{showContact ? supportContact : (lang === 'ru' ? 'Связаться с поддержкой' : 'Contact support')}</a>;
}
