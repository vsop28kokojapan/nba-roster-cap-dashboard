import { Thresholds } from '@/lib/types';
import { yen } from '@/lib/utils';

export default function RuleGuide({ thresholds: t }: { thresholds: Thresholds }) {
  return (
    <section className="rule-guide" aria-labelledby="ruleTitle">
      <div className="section-heading">
        <div>
          <p className="eyebrow dark">CAP RULES 101</p>
          <h2 id="ruleTitle">NBAサラリーキャップ、4分で理解する</h2>
        </div>
        <p>「なぜあのチームはスター選手を取れないの？」その答えがここにあります。</p>
      </div>

      {/* 4 lines visual progression */}
      <div className="rule-grid">
        <article className="rule cap">
          <div className="rule-num">1</div>
          <h3>サラリーキャップ <span className="rule-tag">基準線</span></h3>
          <strong className="rule-amount">{yen(t.salaryCap)}</strong>
          <p>
            チームが使える選手給与の<b>目安の上限</b>。ただしNBAは「ソフトキャップ」なので、
            <b>バード例外</b>など条件を満たせば超えることができます。
            多くのチームが超えています。
          </p>
          <div className="rule-detail-box">
            <b>バード例外とは？</b> 自チームで3年以上プレーした選手を再契約する際は
            キャップを無視して契約可能。これがあるからスター選手が長年同じチームに
            残れます（例：ステフ・カリーとウォリアーズ）。
          </div>
        </article>

        <article className="rule tax">
          <div className="rule-num">2</div>
          <h3>ラグジュアリータックス <span className="rule-tag">罰金ライン</span></h3>
          <strong className="rule-amount">{yen(t.luxuryTax)}</strong>
          <p>
            超えると<b>リーグへ「ぜいたく税」を支払う</b>ライン。
            超えた額に対して税率がかかり、そのお金は他チームに分配されます。
            3年以上連続で超えると税率がさらに上がります。
          </p>
          <div className="rule-detail-box">
            <b>なぜ問題？</b> 例えば税ラインを$10M超えると$15M以上の追加支払いが発生。
            オーナーへの負担は2〜3倍。それでも払って強いチームを保つのが
            レイカーズやウォリアーズ。節約したいチームは敬遠します。
          </div>
        </article>

        <article className="rule first">
          <div className="rule-num">3</div>
          <h3>第1エプロン <span className="rule-tag">補強制限開始</span></h3>
          <strong className="rule-amount">{yen(t.firstApron)}</strong>
          <p>
            お金を払えば済む税ラインとは違い、<b>やれることに制限がかかる</b>ライン。
            サイン＆トレードでの選手獲得が不可、使える契約例外の種類が減ります。
          </p>
          <div className="rule-detail-box">
            <b>具体的な制限：</b>
            <ul>
              <li>サイン＆トレードでの選手受け取り不可</li>
              <li>Bi-Annual例外（BAE）の使用不可</li>
              <li>Mid-Level例外（MLE）の金額が縮小</li>
              <li>トレードで受け取れる給与の上限が厳しくなる</li>
            </ul>
          </div>
        </article>

        <article className="rule second">
          <div className="rule-num">4</div>
          <h3>第2エプロン <span className="rule-tag">最高強度の制限</span></h3>
          <strong className="rule-amount">{yen(t.secondApron)}</strong>
          <p>
            超えると<b>チーム編成がほぼ身動き取れなくなる</b>ライン。
            大型トレードが事実上不可能になり、ドラフト指名権も制限されます。
          </p>
          <div className="rule-detail-box">
            <b>具体的な制限：</b>
            <ul>
              <li>複数選手の給与を合計したトレード不可</li>
              <li>現金をトレードに組み込めない</li>
              <li>TPE（トレード選手例外）の使用不可</li>
              <li><b>7年後の1巡目指名権の放出不可</b>（主要ルール）</li>
              <li>MLE使用不可</li>
            </ul>
          </div>
        </article>
      </div>

      {/* FAQ accordion */}
      <div className="rule-faq">
        <details className="rule-details">
          <summary>「エプロン」って変な名前…なぜそう呼ぶ？</summary>
          <p>
            英語の "apron"（エプロン）は料理用エプロンのこと。
            給与制限を重ねて着込んでいくイメージで使われるようになりました。
            日本語で例えるなら「第2警戒ライン」くらいのニュアンスです。
          </p>
        </details>

        <details className="rule-details">
          <summary>なぜOKCサンダーは指名権を大量に持てる？</summary>
          <p>
            キャップ内に収まっているチームは制限を受けないため、
            自由にトレードで指名権を集められます。
            サンダーは再建期にスター選手をトレードに出すたびに
            将来の指名権を受け取り、現在10枚以上の1巡目指名権を保有しています。
            第2エプロン超えのチームは「7年後の指名権を放出できない」制限があるため、
            こういった戦略を取りにくくなっています。
          </p>
        </details>

        <details className="rule-details">
          <summary>「デッドキャップ」とは？ロスターにいない選手のお金？</summary>
          <p>
            チームが契約を解除（バイアウト）した選手や、トレードで放出した選手の
            給与の一部が「デッドキャップ」として残ります。
            実際に在籍していないのにキャップに計上されるため「デッド（死んでいる）キャップ」と呼ばれます。
            大型バイアウトがあったチームはここが膨らみます。
          </p>
        </details>

        <details className="rule-details">
          <summary>サラリーキャップの金額はどうやって決まる？</summary>
          <p>
            NBAのリーグ全体の収益（主にTV放映権料）の約49%を選手側が受け取る、
            というCBA（労使協定）のルールで決まります。
            リーグの収益が増えるほどキャップも上がります。
            2016年のTV契約更新時に収益が急増し、キャップが1年で$17M以上跳ね上がりました
            （これがケビン・デュラントのウォリアーズ加入を可能にした一因です）。
          </p>
        </details>
      </div>
    </section>
  );
}
