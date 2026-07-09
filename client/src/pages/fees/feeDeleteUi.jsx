export function FeeDeleteStatusBadge({ status }) {
  if (status === 1) {
    return <span className="badge cis-fee-status-badge cis-fee-status-badge--deleted">Deleted</span>;
  }
  return <span className="badge cis-fee-status-badge cis-fee-status-badge--pending">Pending</span>;
}
