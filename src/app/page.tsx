import Link from "next/link";

const features = [
  {
    title: "Give every dollar a job",
    body: "Split each month's money across categories so you know what's spoken for and what's free.",
  },
  {
    title: "Watch savings grow",
    body: "Keep checking, savings, cash and cards side by side. See what each one holds at a glance.",
  },
  {
    title: "Hit your goals",
    body: "Set aside a little each month for the trip, the car or the rainy day, and see how close you are.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero px-4 py-16 sm:py-24">
        <div className="hero-content max-w-2xl text-center">
          <div>
            <h1 className="text-4xl font-bold sm:text-5xl">
              Do I have money for this?
            </h1>
            <p className="py-6 text-lg">
              A budget without the clutter. Log what comes in and goes out, plan
              each month, and get a straight answer before you spend.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/auth?mode=signup" className="btn btn-primary">
                Get started free
              </Link>
              <Link href="/auth" className="btn btn-ghost">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card card-border">
            <div className="card-body">
              <h2 className="card-title">{f.title}</h2>
              <p className="">{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="footer footer-center p-6 text-sm">
        <p>
          DoIHaveMoney doesn&apos;t connect to your bank or move money. You stay
          in control of every entry.
        </p>
      </footer>
    </>
  );
}
