import type {Locale} from '../core/types';
import {exploreMessages} from '../core/explore-i18n';
export function ExploreLink({locale}:{locale:Locale}) {
 return <a className="explore-link" href={`${import.meta.env.BASE_URL}explore/`}>{exploreMessages[locale].explore}</a>;
}
