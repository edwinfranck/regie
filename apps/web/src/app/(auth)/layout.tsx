export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="hidden flex-col justify-between border-r bg-foreground p-12 text-background lg:flex">
        <div className="text-2xl font-semibold tracking-tight">régie</div>
        <div className="max-w-md space-y-4">
          <p className="text-3xl leading-tight font-medium">Une bible, un découpage, N moteurs.</p>
          <p className="text-background/70">
            De l’idée au film : concept, scénario, personnages, lieux, storyboard, génération d’images et de vidéos, en gardant la cohérence d’une étape à
            l’autre.
          </p>
        </div>
        <p className="text-sm text-background/50">Un modèle n’a aucune mémoire entre deux générations. Tout ce qui n’est ni écrit ni montré sera réinventé.</p>
      </section>
      <section className="flex items-center justify-center p-6">{children}</section>
    </main>
  );
}
