export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#f8fbfc_0%,#edf4f7_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80" />
      <div className="hidden flex-1 lg:block">
        <div className="flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="max-w-lg">
            <p className="eyebrow-label text-primary/80">StrataHub</p>
            <h1 className="mt-4 max-w-md text-5xl font-semibold tracking-[-0.06em] text-foreground">
              Clearer building operations from the first login.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Resident requests, building communications, rent collection, and access activity in one calm workspace built for Australian strata teams.
            </p>
          </div>

          <div className="app-panel max-w-2xl p-7">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="panel-kicker">Operations</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">24/7</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Track maintenance, visitors, parcels, and levy workflows without bouncing between tools.
                </p>
              </div>
              <div>
                <p className="panel-kicker">Visibility</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">Live</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Surface what needs action first with stronger hierarchy and building-level context.
                </p>
              </div>
              <div>
                <p className="panel-kicker">Resident Trust</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">Unified</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Keep owners, tenants, reception, and managers aligned through a shared system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10 lg:max-w-[36rem] lg:px-10">
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
