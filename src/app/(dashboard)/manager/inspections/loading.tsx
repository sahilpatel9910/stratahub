export default function InspectionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </section>
    </div>
  );
}
