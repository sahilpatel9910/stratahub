export default function ManagerMaintenanceDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {[1, 2, 3].map((i) => (
        <section key={i} className="app-panel overflow-hidden p-6 md:p-8">
          <div className="space-y-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-8 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
