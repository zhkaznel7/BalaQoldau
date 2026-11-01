import { useId } from 'react';
import './HeroFamilyPhoto.css';

export default function HeroFamilyPhoto() {
  const clipId = useId();

  return <div className="hero-family-photo">
    <svg className="hero-family-mask" width="0" height="0" aria-hidden="true" focusable="false">
      <defs><clipPath id={clipId} clipPathUnits="objectBoundingBox">
        <path d="M .218 0 H .952 Q 1 0 1 .048 V .952 Q 1 1 .952 1 H .048 Q 0 1 0 .952 V .218 Q 0 .198 .014 .184 L .184 .014 Q .198 0 .218 0 Z" />
      </clipPath></defs>
    </svg>
    <div className="hero-family-frame" style={{ clipPath: `url(#${clipId})` }}>
      <img
        src="/images/family.jpg"
        width="612"
        height="408"
        alt="Жарық бөлмеде диванда бірге отырып, күліп отырған ата-ана мен қызы."
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  </div>;
}
