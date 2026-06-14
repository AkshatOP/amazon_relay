import { Gauge, GradeBadge, DefectChips, Icon } from "./ui";
import { fmt } from "../lib/api";

/* Shared Product Health Card — the SAME visual the grader's "Assessment Complete" card and the
   P2P listing produce (gauge + grade badge + defect chips + reasoning + trust lines). Accepts a
   flexible `card` object; reads either GradeResult-style keys (grade/score/...) or the p2p
   health_card keys (condition_grade/condition_score/...). Renders only what's present. */
export default function HealthCard({ card }) {
  const grade = card.grade || card.condition_grade || "A";
  const score = card.score ?? card.condition_score ?? 0;
  const reasoning = card.reasoning || card.notes || card.price_note || "";
  const summary = card.condition_summary || conditionWord(grade);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="font-label-bold text-label-bold text-on-surface flex items-center gap-1">
          <Icon name="verified" className="text-[16px] text-primary" /> Product Health Card
        </h4>
        {card.provenance && (
          <span className="font-mono-code text-mono-code text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{card.provenance}</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <Gauge score={score} />
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2"><GradeBadge grade={grade} /><span className="font-body-md text-body-md text-on-surface-variant">{summary}</span></div>
          <div className="flex flex-wrap gap-2 mt-1"><DefectChips defects={card.defects} /></div>
        </div>
      </div>

      {reasoning && <p className="font-body-md text-body-md text-on-surface-variant border-t border-outline-variant/30 pt-3">{reasoning}</p>}

      <div className="bg-surface-container-low rounded-lg p-3 grid grid-cols-2 gap-3 border border-outline-variant">
        <HCItem k="Original bill" v={card.has_original_bill ? `Verified${card.purchase_date ? " · " + card.purchase_date : ""}` : "Not available"} />
        <HCItem k="Warranty" v={card.warranty || (card.remaining_warranty_years ? `${card.remaining_warranty_years} yr remaining` : "—")} />
        <HCItem k="Age" v={card.age_display || (card.age_years != null ? `${card.age_years} yr` : "—")} />
        <HCItem k="Verified by" v={card.verified_by || "Amazon Relay grading AI"} />
      </div>

      {Array.isArray(card.trust_anchors) && card.trust_anchors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.trust_anchors.map((t, i) => (
            <span key={i} className="bg-success/10 text-success border border-success/30 rounded px-2 py-0.5 font-label-md text-label-md">✓ {t}</span>
          ))}
        </div>
      )}

      {(card.asking_price != null) && (
        <div className="flex items-baseline gap-2">
          <span className="font-headline-md text-headline-md text-on-surface">{fmt.inr(card.asking_price)}</span>
          {card.original_price != null && card.original_price > card.asking_price && (
            <span className="font-body-md text-body-md text-on-surface-variant line-through">{fmt.inr(card.original_price)}</span>
          )}
        </div>
      )}
    </div>
  );
}

const HCItem = ({ k, v }) => (
  <div><p className="font-label-md text-label-md text-on-surface-variant">{k}</p><p className="font-body-md text-body-md text-on-surface">{v}</p></div>
);

function conditionWord(g) {
  return { A: "Grade A — Excellent (near-new)", B: "Grade B — Good", C: "Grade C — Fair", D: "Grade D — Poor" }[g] || "";
}
