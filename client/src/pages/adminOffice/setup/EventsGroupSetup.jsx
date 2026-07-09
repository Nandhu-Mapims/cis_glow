export default function EventsGroupSetup({ data }) {
  if (!data) return null;
  return (
    <div className="alert alert-info mb-0">
      {data.notice || 'Event group setup is not available in this build.'}
    </div>
  );
}
