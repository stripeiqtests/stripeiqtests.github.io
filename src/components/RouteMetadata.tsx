import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useLanguage} from '../lib/i18n';

export function RouteMetadata() {
  const {pathname}=useLocation();const {lang}=useLanguage();
  useEffect(()=>{
    const ru=lang==='ru';
    const privatePage=/^\/(admin|results|payment)(\/|$)/.test(pathname);
    const labels:Record<string,string>=ru?{'/':'Логика и внимание','/privacy':'Конфиденциальность','/terms':'Условия использования'}:
      {'/':'Logic and attention','/privacy':'Privacy','/terms':'Terms of use'};
    const label=labels[pathname]||(pathname.startsWith('/admin')?(ru?'Панель администратора':'Administration'):
      pathname.startsWith('/payment')?(ru?'Проверка оплаты':'Payment status'):
      pathname.startsWith('/results')?(ru?'Результат теста':'Test result'):(ru?'Пройти тест':'Take a test'));
    document.title=`${label} — Inner Code`;
    const description=document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if(description)description.content=ru?'Развлекательные задания на логику, внимание и поиск закономерностей. Результат описывает эту попытку и не является измерением IQ.':
      'Recreational logic, attention and pattern tasks. Results describe this attempt and are not an IQ measurement.';
    let robots=document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}
    robots.content=privatePage?'noindex, nofollow':'index, follow';
    let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if(privatePage){canonical?.remove();return;}
    if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}
    canonical.href=`https://inner-code.me${pathname}`;
  },[pathname,lang]);
  return null;
}
