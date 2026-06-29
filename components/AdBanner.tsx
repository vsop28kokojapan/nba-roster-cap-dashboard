'use client';

import { useEffect, useRef } from 'react';

const PUB_ID = 'ca-pub-XXXXXXXXXXXXXXXXX'; // ← AdSense取得後にここを差し替える

type AdFormat = 'auto' | 'horizontal' | 'rectangle';

interface Props {
  slot: string;
  format?: AdFormat;
  style?: React.CSSProperties;
}

export default function AdBanner({ slot, format = 'auto', style }: Props) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (PUB_ID.includes('XXXX')) return; // プレースホルダー中はスキップ
    try {
      // @ts-expect-error adsbygoogle is injected by Google
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  if (PUB_ID.includes('XXXX')) {
    return (
      <div className="ad-placeholder" style={style}>
        <span>広告枠 (AdSense ID設定後に有効化)</span>
      </div>
    );
  }

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client={PUB_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
