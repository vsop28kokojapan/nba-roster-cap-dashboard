import { Thresholds } from '@/lib/types';
import { yen } from '@/lib/utils';

export default function RuleGuide({ thresholds: t }: { thresholds: Thresholds }) {
  return (
    <section className="rule-guide" aria-labelledby="ruleTitle">
      <div className="section-heading">
        <div>
          <p className="eyebrow dark">CAP RULES 101</p>
          <h2 id="ruleTitle">4つのラインを、やさしく理解</h2>
        </div>
        <p>右へ行くほど支出が増え、チーム編成の自由度が下がります。</p>
      </div>
      <div className="rule-grid">
        <article className="rule cap">
          <span>1</span>
          <h3>サラリーキャップ</h3>
          <strong className="rule-amount">{yen(t.salaryCap)}</strong>
          <p><b>基本の予算ライン。</b>ただしNBAは「ソフトキャップ」なので、バード例外などを使えば超えることができます。</p>
          <small>超えただけでは罰金なし</small>
        </article>
        <article className="rule tax">
          <span>2</span>
          <h3>ラグジュアリータックス</h3>
          <strong className="rule-amount">{yen(t.luxuryTax)}</strong>
          <p><b>ぜいたく税の課税ライン。</b>超過額に応じてリーグへ税金を支払います。常連チームにはより重い税率があります。</p>
          <small>主な影響：オーナーの支出増</small>
        </article>
        <article className="rule first">
          <span>3</span>
          <h3>第1エプロン</h3>
          <strong className="rule-amount">{yen(t.firstApron)}</strong>
          <p><b>補強方法に制限が始まるライン。</b>サイン＆トレードでの獲得や、一部例外・トレードでの給与受取額が制限されます。</p>
          <small>主な影響：補強の選択肢が減る</small>
        </article>
        <article className="rule second">
          <span>4</span>
          <h3>第2エプロン</h3>
          <strong className="rule-amount">{yen(t.secondApron)}</strong>
          <p><b>最も厳しい制限ライン。</b>複数選手の給与合算、現金の放出、過去に作ったTPEの利用などが難しくなります。</p>
          <small>主な影響：大型トレードが非常に困難</small>
        </article>
      </div>
      <details className="rule-details">
        <summary>もう少し詳しく：なぜエプロンが重要？</summary>
        <p>キャップ超過は珍しくありませんが、エプロン超過は「お金を払えば済む」だけではありません。特に第2エプロンを超えるとトレード手段やドラフト指名権にも制約が及ぶため、現在の戦力を保ちながら補強することが難しくなります。表示は主なルールの要約で、例外や適用時期があります。</p>
      </details>
    </section>
  );
}
