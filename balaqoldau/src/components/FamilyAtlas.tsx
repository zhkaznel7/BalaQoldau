import { ArrowUpRight, Compass, GraduationCap, Palette } from 'lucide-react';
import Illustration from './Illustration';

export default function FamilyAtlas() {
  return <div className="family-atlas">
    <div className="atlas-heading"><Compass size={20} aria-hidden="true" /><span>МҮМКІНДІКТЕР АТЛАСЫ</span><span>01 / ∞</span></div>
    <svg className="atlas-paths" viewBox="0 0 520 510" fill="none" aria-hidden="true">
      <path d="M-40 335C70 450 85 40 250 96S570 181 445 400 220 481 170 388 480 327 548 60" stroke="currentColor" strokeWidth="1" />
      <path d="M-15 366C93 470 111 61 251 121S540 190 421 397 239 449 195 382 480 300 552 87" stroke="currentColor" strokeWidth="1" />
      <path d="M3 395C122 481 136 90 253 146S511 200 397 394 258 419 220 376 477 275 555 114" stroke="currentColor" strokeWidth="1" />
      <circle cx="104" cy="285" r="7" fill="#A8E6CF" stroke="#596B58" /><circle cx="432" cy="150" r="5" fill="#7659E8" />
    </svg>
    <Illustration />
    <div className="atlas-stamp"><Palette size={20} aria-hidden="true" /><span>Қызығушылықтан<br/><strong>жаңа мүмкіндікке</strong></span><ArrowUpRight size={18} aria-hidden="true" /></div>
    <div className="atlas-bookmark"><GraduationCap size={22} aria-hidden="true" /></div>
    <div className="atlas-caption"><span>Әр баланың өз жолы бар.</span><span>БІРГЕ ТАБАЙЫҚ ↗</span></div>
  </div>;
}
