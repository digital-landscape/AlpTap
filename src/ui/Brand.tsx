import {MountainIcon} from './MountainIcon';
export function Brand({tagline,dateLabel}:{tagline:string;dateLabel:string}){
 return <a className="brand" href="./" aria-label="AlpTap"><span className="brand-mark"><MountainIcon/></span><span>Alp<span className="brand-light">Tap</span><small className="brand-tagline">{tagline}</small><small className="brand-date">{dateLabel}</small></span></a>;
}
