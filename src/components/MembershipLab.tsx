import {
  useMembership,
  setMembershipPreview,
  resolveEntitlement,
  beginCheckout,
} from "../services/membership";
import type { MembershipStatus } from "../services/membership";
import { useState } from "react";
const states: MembershipStatus[] = [
  "signed-out",
  "free",
  "premium",
  "expired",
  "cancelled",
  "loading",
  "error",
  "setup-pending",
];
export default function MembershipLab() {
  const membership = useMembership();
  const [result, setResult] = useState("");
  const entitlement = resolveEntitlement({
    access: "premium",
    status: "available",
  });
  return (
    <section className="page content-section">
      <div className="page-intro">
        <h1>Membership test lab.</h1>
        <p>
          Development only. This control changes a temporary test state, never a
          real account or purchase. No premium media is unlocked in production.
        </p>
      </div>
      <label>
        Simulated membership{" "}
        <select
          value={membership.status}
          onChange={(e) =>
            setMembershipPreview(e.target.value as MembershipStatus)
          }
        >
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="editorial-note">
        <h2>{membership.status}</h2>
        <p>{membership.message}</p>
        <p>
          Available premium fixture:{" "}
          {entitlement.allowed ? "test entitlement allowed" : "access denied"}.{" "}
          {entitlement.reason}
        </p>
        <p>
          Unreleased original:{" "}
          {
            resolveEntitlement({ access: "premium", status: "development" })
              .reason
          }
        </p>
        <button
          className="button secondary"
          onClick={async () => setResult((await beginCheckout()).message)}
        >
          Check checkout boundary
        </button>
        <p role="status">{result}</p>
        <button
          className="text-link"
          onClick={() => setMembershipPreview(null)}
        >
          Reset to actual service state
        </button>
      </div>
    </section>
  );
}
